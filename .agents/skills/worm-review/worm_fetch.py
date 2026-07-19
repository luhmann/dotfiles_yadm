#!/usr/bin/env python3
"""WORM review data fetcher for team Thunder.

Deterministic: fetches SLO ratios, alert evaluations, Scalyr error counts,
and infra costs into a dated dump directory. No judgment — analysis is done
by the worm-review skill on top of this dump.
"""
import csv
import functools
import json
import os
import re
import subprocess
import sys
import tomllib
from datetime import date, datetime
from pathlib import Path

import yaml

WORM_ROOT = Path(os.environ.get("WORM_ROOT", Path.home() / "icloud/org/_scratch/purchase-orders-management/worm"))
DASH0_CONFIG = Path(os.environ.get("DASH0_CONFIG", Path.home() / "dev/z/dash0-config"))
SLO_LABEL = "responsible_team=Purchasing"
TEAM = "thunder"
SUNRISE_API = "https://sunrise-api.platform-infrastructure.zalan.do/v1"
# Fallback if the Sunrise API is unavailable (snapshot of owner=thunder, 2026-07-17)
FALLBACK_APPS = [
    "block-orders", "condition-agreement", "edi-order", "purchase-orders-creator",
    "purchase-orders-export", "user-authorization", "web-order", "zolaris",
]
SCALYR_ERROR_FILTER = "(logLevel = 'ERROR' or level='ERROR') environment in('production','live')"
KRR_URL = "https://kube-resource-report.stups.zalan.do/applications.tsv"
COST_DELTA_PCT = 20
NOBL9_ORG = os.environ.get("NOBL9_ORG", "zalando")
NOBL9_URL = "https://app.nobl9.com"
NAKADI_URL = "https://nakadi-live.nakadi.zalan.do"
NAKADI_BACKLOG_THRESHOLD = 100
# Alerts for decommissioned operations (confirmed not in use, 2026-07-16).
# No machine-readable marker exists in Dash0 (enabled=true despite being dead),
# so they are excluded explicitly. Cleanup = delete from dash0-config.
IGNORED_ALERTS = {
    "Failed PO PDF Generation",
    "[WOB] Download external feedback template has errors",
    "[WOB] Download internal feedback has errors",
    "[WOB] Upload feedback has errors",
}

OUT = WORM_ROOT / date.today().strftime("%Y_%m_%d")
ERRORS: list[str] = []


def log(msg: str) -> None:
    """Print a progress message to stdout."""
    print(f"[worm-fetch] {msg}", flush=True)


def err(step: str, msg: str) -> None:
    """Record a non-fatal error: collected into _errors.log and echoed to stderr."""
    ERRORS.append(f"{step}: {msg}")
    print(f"[worm-fetch] ERROR in {step}: {msg}", file=sys.stderr, flush=True)


def run(cmd: list[str], timeout: int = 120) -> str:
    """Run a CLI command and return stdout; raise RuntimeError on non-zero exit."""
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed (rc={result.returncode}): {result.stderr.strip()[:300]}")
    return result.stdout


def widen(promql: str, window: str, offset: str = "") -> str:
    """Replace ALL range windows in a PromQL expression (e.g. [2m], [30m]) with `window`.

    Alert/SLO exprs are written for live evaluation with short windows; widening
    to 7d turns them into a weekly aggregate. Must catch every window — a missed
    [30m] once produced a false NO_DATA. With `offset` the widened window is
    shifted into the past (e.g. offset="7d" evaluates the previous week).
    """
    replacement = f"[{window}] offset {offset}" if offset else f"[{window}]"
    return re.sub(r"\[\d+[smhd]\]", replacement, promql)


def baseline_for(filename: str) -> Path | None:
    """Find the newest previous dump containing `filename` and log its age.

    Snapshot-only sources (costs, Nakadi stats) have no history at the
    source; weekly dumps are the only baseline. The age is logged so a
    stale baseline (missed runs) is visible rather than silently skewing
    the diff.
    """
    previous = sorted(p for p in WORM_ROOT.glob(f"*/{filename}") if p.parent != OUT)
    if not previous:
        log(f"no previous {filename} — skipping diff (first run baseline)")
        return None
    path = previous[-1]
    age = (date.today() - datetime.strptime(path.parent.name, "%Y_%m_%d").date()).days
    log(f"{filename} baseline: {path.parent.name} ({age}d old)")
    if age > 10:
        err("baseline", f"{filename} baseline is {age}d old — diffs span more than one review cycle")
    return path


def d0_instant(promql: str) -> str:
    """Evaluate an instant PromQL query via the dash0 CLI.

    Returns the scalar result as a string, or "absent" when the series does
    not exist or the query fails (failure is also recorded via err()).
    """
    try:
        out = run(["dash0", "metrics", "instant", "--promql", promql, "-o", "json"])
        result = json.loads(out).get("data", {}).get("result", [])
        return result[0]["value"][1] if result else "absent"
    except (RuntimeError, subprocess.TimeoutExpired, json.JSONDecodeError, KeyError, IndexError) as e:
        err("dash0", f"{promql[:80]}… -> {e}")
        return "absent"


def nobl9_token() -> str | None:
    """Get a bearer token for the Nobl9 REST API using local sloctl credentials.

    sloctl itself only manages configuration; computed SLO status lives in
    the separate SLO Status API v2, which needs this token.
    """
    try:
        config = tomllib.loads((Path.home() / ".config/nobl9/config.toml").read_text())
        context = config["contexts"][config["defaultContext"]]
        out = run([
            "curl", "-sf", "-X", "POST", f"{NOBL9_URL}/api/accessToken",
            "-u", f"{context['clientId']}:{context['clientSecret']}",
            "-H", f"Organization: {NOBL9_ORG}",
        ])
        return json.loads(out)["access_token"]
    except (OSError, RuntimeError, subprocess.TimeoutExpired, json.JSONDecodeError, KeyError, tomllib.TOMLDecodeError) as e:
        err("nobl9-status", f"token fetch failed: {e}")
        return None


def nobl9_status(token: str, project: str, slo_name: str) -> dict:
    """Fetch Nobl9's official computed status for one SLO (Status API v2).

    Returns the first objective's status dict (reliability,
    errorBudgetRemainingPercentage, burnRate, ...) or {} on failure.
    This is the number the team sees in the Nobl9 UI — minute-sampled and
    extrapolated, so low-volume errors may not register at all.
    """
    try:
        out = run([
            "curl", "-sf", f"{NOBL9_URL}/api/v2/slos/{slo_name}?project={project}",
            "-H", f"Authorization: Bearer {token}",
            "-H", f"Organization: {NOBL9_ORG}",
            "-H", f"Project: {project}",
        ])
        return json.loads(out)["objectives"][0]
    except (RuntimeError, subprocess.TimeoutExpired, json.JSONDecodeError, KeyError, IndexError) as e:
        err("nobl9-status", f"{slo_name}: {e}")
        return {}


def write_tsv(path: Path, rows: list[list[str]]) -> None:
    """Write rows as a tab-separated file."""
    with path.open("w", newline="") as f:
        csv.writer(f, delimiter="\t", lineterminator="\n").writerows(rows)


def fetch_slos() -> None:
    """Fetch Purchasing SLOs from Nobl9 and recompute their 7d good/total ratios.

    Writes slos.json (raw sloctl dump, incl. 28d twins), slo_ratios.tsv
    (7d-window SLOs only) and slo_error_days.tsv (per degraded SLO: daily
    ERROR counts so span drill-downs can target a single day — 7d span
    queries time out).

    Two complementary signals per SLO:
    - raw good/total from the SLO's own Dash0 PromQL widened to 7d — the
      literal event count, used for error *discovery* (flag DEGRADED).
      Nobl9's smoothing can report reliability 1.0 while real ERROR spans
      exist, so this is the drill-down trigger.
    - official reliability/budget/burnRate from the Nobl9 Status API v2 —
      what the team sees in the UI (flag BREACH when below target).
    """
    log("fetching SLOs (sloctl)")
    slos_raw = run(["sloctl", "get", "slo", "-A", "-l", SLO_LABEL, "-o", "json"])
    (OUT / "slos.json").write_text(slos_raw)
    token = nobl9_token()

    ratios: list[list[str]] = [["name", "uuid", "target", "good/total", "raw_ratio", "prev_good/total", "prev_ratio", "official_reliability", "budget_remaining_pct", "burn_rate", "flag"]]
    error_days: list[list[str]] = []
    for slo in json.loads(slos_raw):
        uuid = slo["metadata"]["name"]
        if not uuid.endswith("-7"):
            continue
        objectives = slo["spec"]["objectives"]
        if len(objectives) > 1:
            err("slos", f"{uuid}: {len(objectives)} objectives, only the first is evaluated")
        objective = objectives[0]
        name = objective["displayName"]
        target = objective["target"]
        good_q = objective["countMetrics"]["good"]["dash0"]["promql"]
        total_q = objective["countMetrics"]["total"]["dash0"]["promql"]

        good = d0_instant(widen(good_q, "7d"))
        total = d0_instant(widen(total_q, "7d"))
        flags = []
        prev_counts, prev_ratio = "-", "-"
        if total in ("absent", "0"):
            ratio = "NO_DATA"
            flags.append("NO_DATA")
        elif good == "absent":
            ratio = "ERR"
            flags.append("ERR")
            err("slos", f"{name} ({uuid}): good query absent but total={total}")
        else:
            ratio = f"{float(good) / float(total):.4f}"
            if float(ratio) < float(target):
                flags.append("DEGRADED")
            prev_good = d0_instant(widen(good_q, "7d", offset="7d"))
            prev_total = d0_instant(widen(total_q, "7d", offset="7d"))
            prev_counts = f"{prev_good}/{prev_total}"
            if prev_total not in ("absent", "0") and prev_good != "absent":
                prev_ratio = f"{float(prev_good) / float(prev_total):.4f}"

        status = nobl9_status(token, slo["metadata"]["project"], uuid) if token else {}
        reliability = status.get("reliability")
        official = "?" if reliability is None else f"{reliability:.6f}"
        budget = "?" if "errorBudgetRemainingPercentage" not in status else f"{status['errorBudgetRemainingPercentage']:.4f}"
        burn_rate = str(status.get("burnRate", "?"))
        if reliability is not None and reliability < float(target):
            flags.append("BREACH")

        ratios.append([name, uuid, str(target), f"{good}/{total}", ratio, prev_counts, prev_ratio, official, budget, burn_rate, ",".join(flags)])

        if "DEGRADED" in flags:
            metric = re.search(r"s2m\.[A-Za-z0-9]+\.red", total_q).group(0)
            days = []
            for offset in range(7):
                value = d0_instant(
                    f'histogram_count(sum(increase({{otel_metric_name="{metric}",'
                    f'otel_metric_type="exponential_histogram",otel_span_status_code="ERROR"}}'
                    f"[1d] offset {offset}d)))"
                )
                days.append(f"day-{offset + 1}={value}")
            error_days.append([name, metric, ",".join(days)])

    write_tsv(OUT / "slo_ratios.tsv", ratios)
    write_tsv(OUT / "slo_error_days.tsv", error_days)
    breaches = sum(1 for r in ratios[1:] if "BREACH" in r[10])
    degraded = sum(1 for r in ratios[1:] if "DEGRADED" in r[10])
    log(f"slo_ratios.tsv: {breaches} breach(es), {degraded} degraded")


def fetch_nobl9_alerts() -> None:
    """Fetch Nobl9 alert history and keep alerts belonging to our SLOs.

    Writes nobl9_alerts.json. History caps at ~1000 entries (~10 days) —
    sufficient for a weekly cadence.
    """
    log("fetching Nobl9 alerts")
    slo_names = {s["metadata"]["name"] for s in json.loads((OUT / "slos.json").read_text())}
    alerts = json.loads(run(["sloctl", "get", "alerts", "-A", "-o", "json"]))
    matching = [a for a in alerts if a["spec"]["slo"]["name"] in slo_names]
    (OUT / "nobl9_alerts.json").write_text(json.dumps(matching, indent=2))
    log(f"nobl9_alerts.json: {len(matching)} matching alert(s)")


def fetch_alert_eval() -> None:
    """Evaluate every Thunder alert rule from dash0-config over the past 7d.

    Writes alert_eval.tsv (alert, threshold, 7d value, previous week's
    value, source file) and alert_nodata.tsv (for absent/NaN evals: each underlying metric probed at
    7d and 90d — the seed for broken-vs-quiet triage). Alerts on the
    IGNORED_ALERTS list are marked IGNORED and skipped. The threshold
    comparison itself is left to the analysis phase; the value is reported
    next to the threshold.
    """
    log("evaluating dash0-config alert rules")
    evals: list[list[str]] = [["alert", "threshold", "value_7d", "prev_7d", "source"]]
    nodata: list[list[str]] = []
    for path in sorted(DASH0_CONFIG.glob("pt/thunder.alert.*.yaml")):
        doc = yaml.safe_load(path.read_text())
        rule = doc["spec"]["groups"][0]["rules"][0]
        name = rule["alert"]
        if name in IGNORED_ALERTS:
            evals.append([name, "-", "IGNORED", "-", path.name])
            continue
        threshold = (
            doc["metadata"].get("annotations", {}).get("dash0-threshold-critical")
            or rule.get("annotations", {}).get("dash0-threshold-critical")
            or "?"
        )
        expr = rule["expr"].rsplit(">", 1)[0].strip()
        value = d0_instant(widen(expr, "7d"))
        prev = "-" if value in ("absent", "NaN") else d0_instant(widen(expr, "7d", offset="7d"))
        evals.append([name, str(threshold), value, prev, path.name])

        if value in ("absent", "NaN"):
            for metric in sorted(set(re.findall(r'otel_metric_name="([^"]+)"', expr))):
                v7 = d0_instant(f'sum(increase({{otel_metric_name="{metric}"}}[7d]))')
                v90 = d0_instant(f'sum(increase({{otel_metric_name="{metric}"}}[90d]))')
                nodata.append([name, metric, f"7d={v7}", f"90d={v90}"])

    write_tsv(OUT / "alert_eval.tsv", evals)
    write_tsv(OUT / "alert_nodata.tsv", nodata)
    log(f"alert_eval.tsv: {len(evals) - 1} rule(s), {len({r[0] for r in nodata})} with no data")


@functools.cache
def team_apps() -> tuple[str, ...]:
    """Fetch the team's registered applications from the official Sunrise API.

    Ownership registry, so it also includes apps that emit no logs or are
    not in the current kube-resource-report snapshot — a zero-count row is
    informative. Falls back to FALLBACK_APPS if the API is unavailable.
    """
    try:
        token = run(["ztoken"]).strip()
        out = run(["curl", "-sf", "-H", f"Authorization: Bearer {token}", f"{SUNRISE_API}/applications?owner={TEAM}"])
        apps = tuple(sorted(app["id"] for app in json.loads(out)))
        if not apps:
            raise RuntimeError("empty application list")
        return apps
    except (RuntimeError, subprocess.TimeoutExpired, json.JSONDecodeError, KeyError, TypeError) as e:
        err("sunrise", f"falling back to hardcoded app list: {e}")
        return tuple(FALLBACK_APPS)


def fetch_scalyr() -> None:
    """Count production ERROR logs per team app, this week vs last week.

    App list comes from the Sunrise API (team_apps). Writes
    scalyr_counts.tsv (week-over-week counts per app) and
    scalyr_messages/<app>.csv (top error messages this week). The clean
    message lives in different parsed fields per logging setup —
    `message_` (JSON logback) or `log` (scala apps) — so both facets are
    merged; the raw `message` field is useless (timestamps/threads make
    every line unique).
    """
    log("fetching Scalyr error counts")
    counts: list[list[str]] = [["application", "this_week", "last_week"]]
    for app in team_apps():
        query = f"{SCALYR_ERROR_FILTER} application='{app}'"

        def count(*window: str) -> str:
            try:
                return run(["scalyr", "numeric-query", query, *window, "--function", "count"]).strip()
            except (RuntimeError, subprocess.TimeoutExpired) as e:
                err("scalyr", f"numeric-query {app}: {e}")
                return "ERR"

        counts.append([app, count("--start", "7d"), count("--start", "14d", "--end", "7d")])
        messages: list[tuple[int, str]] = []
        for field in ("message_", "log"):
            try:
                facets = run(["scalyr", "facet-query", query, field, "--start", "7d", "--count", "15"])
                messages += [(int(r[0]), r[1]) for r in list(csv.reader(facets.splitlines()))[1:] if len(r) == 2]
            except (RuntimeError, subprocess.TimeoutExpired, ValueError) as e:
                err("scalyr", f"facet-query {app} {field}: {e}")
        top = sorted(messages, reverse=True)[:15]
        with (OUT / "scalyr_messages" / f"{app}.csv").open("w", newline="") as f:
            csv.writer(f).writerows([["count", "message"], *top])
    write_tsv(OUT / "scalyr_counts.tsv", counts)
    log("scalyr_counts.tsv done")


def fetch_nakadi() -> None:
    """Snapshot Nakadi subscription backlogs for all team apps.

    Queries the Nakadi API directly (same source the team's ZMON check
    12333 wraps) for every subscription owned by a team app (both `<app>`
    and `stups_<app>` owner spellings). Writes nakadi_stats.tsv with
    per-event-type unconsumed events, max consumer lag, and partition
    assignment. Flags: BACKLOG (unconsumed > NAKADI_BACKLOG_THRESHOLD),
    UNASSIGNED (no partition has a consumer — either a dead consumer or a
    stale subscription). The API is snapshot-only, so prev_unconsumed
    comes from the previous dump (baseline_for).
    """
    log("fetching Nakadi subscription stats")
    token = run(["ztoken"]).strip()

    def get(path: str) -> dict:
        return json.loads(run(["curl", "-sf", "-H", f"Authorization: Bearer {token}", f"{NAKADI_URL}{path}"]))

    prev: dict[tuple[str, str], str] = {}
    if baseline := baseline_for("nakadi_stats.tsv"):
        with baseline.open() as f:
            for r in list(csv.reader(f, delimiter="\t"))[1:]:
                prev[(r[2], r[1])] = r[3]

    rows = [["app", "event_type", "subscription_id", "unconsumed", "max_lag_s", "assigned_partitions", "prev_unconsumed", "flag"]]
    for app in team_apps():
        subscriptions = []
        for owner in (app, f"stups_{app}"):
            try:
                subscriptions += get(f"/subscriptions?owning_application={owner}&limit=100")["items"]
            except (RuntimeError, subprocess.TimeoutExpired, json.JSONDecodeError, KeyError) as e:
                err("nakadi", f"subscriptions for {owner}: {e}")
        for sub in subscriptions:
            try:
                stats = get(f"/subscriptions/{sub['id']}/stats?show_time_lag=true")["items"]
            except (RuntimeError, subprocess.TimeoutExpired, json.JSONDecodeError, KeyError) as e:
                err("nakadi", f"stats for {sub['id']}: {e}")
                continue
            for event_type in stats:
                partitions = event_type["partitions"]
                unconsumed = sum(p.get("unconsumed_events", 0) for p in partitions)
                max_lag = max((p.get("consumer_lag_seconds", 0) for p in partitions), default=0)
                assigned = sum(1 for p in partitions if p.get("state") == "assigned")
                flags = []
                if unconsumed > NAKADI_BACKLOG_THRESHOLD:
                    flags.append("BACKLOG")
                if assigned == 0:
                    flags.append("UNASSIGNED")
                rows.append([
                    app, event_type["event_type"], sub["id"], str(unconsumed), str(max_lag),
                    f"{assigned}/{len(partitions)}", prev.get((sub["id"], event_type["event_type"]), ""), ",".join(flags),
                ])
    write_tsv(OUT / "nakadi_stats.tsv", rows)
    flagged = sum(1 for r in rows[1:] if r[7])
    log(f"nakadi_stats.tsv: {len(rows) - 1} subscription event type(s), {flagged} flagged")


def fetch_costs() -> None:
    """Snapshot team infra costs from kube-resource-report and diff vs last run.

    Writes costs.tsv (team rows of applications.tsv) and costs_diff.tsv
    (per app: NEW = appeared, GONE = disappeared, DELTA = cost changed more
    than COST_DELTA_PCT). kube-resource-report only serves a current
    snapshot, so history exists only through these weekly dumps; the first
    run has no baseline and skips the diff (baseline_for).
    """
    log("fetching kube-resource-report costs")
    token = run(["ztoken"]).strip()
    tsv = run(["curl", "-sf", "-H", f"Authorization: Bearer {token}", KRR_URL])
    rows = [r for r in csv.reader(tsv.splitlines(), delimiter="\t")]
    team_rows = [rows[0]] + [r for r in rows[1:] if r[1] == TEAM]
    write_tsv(OUT / "costs.tsv", team_rows)

    previous = baseline_for("costs.tsv")
    if not previous:
        return
    prev_costs = {r[0]: float(r[8]) for r in list(csv.reader(previous.open(), delimiter="\t"))[1:]}
    diff: list[list[str]] = [["application", "prev_cost", "cost", "flag"]]
    current_apps = set()
    for row in team_rows[1:]:
        app, cost = row[0], float(row[8])
        current_apps.add(app)
        prev = prev_costs.get(app)
        if prev is None:
            flag = "NEW"
        elif prev > 0 and abs(cost - prev) / prev * 100 > COST_DELTA_PCT:
            flag = "DELTA"
        else:
            flag = ""
        diff.append([app, "" if prev is None else f"{prev:.2f}", f"{cost:.2f}", flag])
    for app, prev in prev_costs.items():
        if app not in current_apps:
            diff.append([app, f"{prev:.2f}", "", "GONE"])
    write_tsv(OUT / "costs_diff.tsv", diff)
    log(f"costs_diff.tsv vs {previous}")


def main() -> int:
    """Run all fetch steps; each step is isolated so one failure keeps the rest."""
    (OUT / "scalyr_messages").mkdir(parents=True, exist_ok=True)
    log(f"WORM fetch -> {OUT}")
    for step in (fetch_slos, fetch_nobl9_alerts, fetch_alert_eval, fetch_scalyr, fetch_nakadi, fetch_costs):
        try:
            step()
        except Exception as e:
            err(step.__name__, str(e))
    (OUT / "_errors.log").write_text("".join(f"{e}\n" for e in ERRORS))
    log(f"done. errors: {len(ERRORS)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
