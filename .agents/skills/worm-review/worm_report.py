#!/usr/bin/env python3
"""Render a self-contained HTML report from a WORM dump directory.

Deterministic: all data sections come straight from the dump TSVs, so a
human can audit the agent's logic against the same numbers. Agent
determinations are read from findings.json (written by the worm-review
skill) and rendered next to the data; without it the report shows the
data with an "analysis pending" banner.

Usage: worm_report.py [dump_dir]   (default: newest dump under WORM_ROOT)
"""
import csv
import html
import json
import os
import sys
import urllib.parse
from pathlib import Path

WORM_ROOT = Path(os.environ.get("WORM_ROOT", Path.home() / "icloud/org/_scratch/purchase-orders-management/worm"))
SCALYR_ERROR_FILTER = "(logLevel = 'ERROR' or level='ERROR') environment in('production','live')"
GRAFANA_DASHBOARD = "https://grafana.zalando.net/d/ffqlgwy089fr4e/thunder-dashboard-copy?orgId=1"
KRR_TEAM_PAGE = "https://kube-resource-report.stups.zalan.do/team-thunder.html"
DASH0_CONFIG_GITHUB = "https://github.com/zalando-build/dash0-config/blob/main/pt"
NOBL9_DASHBOARD = "https://app.nobl9.com/slo?org=zalando&labels=responsible_team:Purchasing"

# Hallmark · macrostructure: Ledger (numbered long document) · theme: custom
# (warm paper · ink · oxblood accent · Fraunces / IBM Plex Sans / JetBrains Mono)
CSS = """
:root {
  --paper: oklch(97.5% 0.008 85);
  --paper-2: oklch(95% 0.012 85);
  --ink: oklch(24% 0.015 60);
  --ink-soft: oklch(45% 0.02 60);
  --hairline: oklch(88% 0.015 80);
  --accent: oklch(48% 0.16 35);
  --accent-soft: oklch(94% 0.03 35);
  --amber: oklch(75% 0.13 80);
  --amber-soft: oklch(95% 0.04 85);
  --stone: oklch(70% 0.01 80);
  --stone-soft: oklch(93% 0.005 80);
  --ok: oklch(55% 0.1 155);
  --bar: oklch(65% 0.06 240);
  --font-display: "Fraunces", ui-serif, Georgia, serif;
  --font-body: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
* { box-sizing: border-box; }
html, body { overflow-x: clip; }
body {
  font-family: var(--font-body); font-size: 14.5px; line-height: 1.55;
  color: var(--ink); background: var(--paper); margin: 0;
}
main { max-width: 1240px; margin: 0 auto; padding: 0 2rem 6rem; }
nav {
  position: sticky; top: 0; z-index: 10; background: var(--paper);
  border-bottom: 1px solid var(--hairline);
  display: flex; gap: 2rem; align-items: baseline;
  padding: 1rem 2.5rem; font-size: .85rem;
}
nav .brand { font-family: var(--font-display); font-weight: 600; font-size: 1.05rem; margin-right: 1.2rem; }
nav a { color: var(--ink-soft); }
nav a:hover { color: var(--accent); }
header.masthead { padding: 5rem 0 2.6rem; border-bottom: 3px solid var(--ink); }
header.masthead h1 {
  font-family: var(--font-display); font-weight: 550; font-size: clamp(2.4rem, 4.5vw, 3.6rem);
  letter-spacing: -0.02em; line-height: 1.05; margin: 0 0 .9rem;
}
header.masthead .dateline { color: var(--ink-soft); font-size: .95rem; letter-spacing: .01em; }
.statstrip {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  border-bottom: 1px solid var(--hairline);
}
.statstrip > div { padding: 2rem 1.4rem 1.8rem 0; border-right: 1px solid var(--hairline); }
.statstrip > div + div { padding-left: 1.4rem; }
.statstrip > div:last-child { border-right: none; }
.statstrip .n { font-family: var(--font-mono); font-size: 2rem; font-weight: 600; line-height: 1.1; }
.statstrip .n.hot { color: var(--accent); }
.statstrip .l { font-size: .74rem; text-transform: uppercase; letter-spacing: .09em; color: var(--ink-soft); margin-top: .45rem; line-height: 1.35; }
section { margin-top: 3.2rem; }
h2 {
  font-family: var(--font-display); font-weight: 550; font-size: 1.45rem;
  letter-spacing: -0.01em; margin: 0 0 .3rem; display: flex; align-items: baseline; gap: .7rem;
}
h2 .no { font-family: var(--font-mono); font-size: .8rem; font-weight: 400; color: var(--accent); }
.srclinks { font-size: .82rem; color: var(--ink-soft); margin: 0 0 .9rem; }
table { border-collapse: collapse; width: 100%; font-size: .88rem; }
th {
  text-align: left; font-size: .72rem; text-transform: uppercase; letter-spacing: .08em;
  font-weight: 600; color: var(--ink-soft); padding: .45rem .7rem .45rem 0;
  border-bottom: 1.5px solid var(--ink); white-space: nowrap;
}
th .u { font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--stone); }
td { padding: .42rem .7rem .42rem 0; border-bottom: 1px solid var(--hairline); vertical-align: top; }
td.num, th.num { text-align: right; }
td.num { font-family: var(--font-mono); font-size: .84rem; white-space: nowrap; }
tr:hover td { background: var(--paper-2); }
tr.flagged td { background: var(--accent-soft); }
tr.flagged:hover td { background: var(--accent-soft); }
.badge {
  display: inline-block; padding: .05em .55em; border-radius: 2px;
  font-family: var(--font-mono); font-size: .68rem; font-weight: 600; letter-spacing: .04em;
}
.badge.bad { background: var(--accent); color: var(--paper); }
.badge.warn { background: var(--amber-soft); color: var(--ink); border: 1px solid var(--amber); }
.badge.info { background: var(--stone-soft); color: var(--ink-soft); }
.finding {
  background: var(--paper-2); padding: .8rem 1.1rem; margin: .8rem 0;
  border-left: 3px solid var(--stone);
}
.finding.v-action { border-left-color: var(--accent); }
.finding.v-watch { border-left-color: var(--amber); }
.finding .meta { color: var(--ink-soft); font-size: .82rem; margin-top: .25rem; }
.finding .fid { font-family: var(--font-mono); color: var(--accent); font-weight: 600; margin-right: .4rem; }
.pending {
  border: 1.5px solid var(--accent); background: var(--accent-soft);
  padding: .9rem 1.2rem; margin: 1.4rem 0; font-weight: 600;
}
.summary { font-family: var(--font-display); font-size: 1.2rem; line-height: 1.45; margin: 2.2rem 0 0; }
details { margin: .15rem 0 0; }
summary { cursor: pointer; color: var(--accent); font-size: .8rem; }
details > div { font-family: var(--font-mono); font-size: .76rem; color: var(--ink-soft); padding: .3rem 0 .2rem .8rem; border-left: 2px solid var(--hairline); margin-top: .3rem; overflow-wrap: anywhere; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; text-underline-offset: 2px; }
.muted { color: var(--stone); }
svg { vertical-align: middle; }
.subid { font-family: var(--font-mono); font-size: .72rem; color: var(--stone); }
.errlog {
  background: var(--ink); color: var(--amber-soft); padding: .9rem 1.1rem;
  font-family: var(--font-mono); font-size: .78rem; white-space: pre-wrap; overflow-wrap: anywhere;
}
tbody td { min-width: 0; }
@media (max-width: 768px) {
  main { padding: 0 1rem 4rem; }
  nav { padding: .8rem 1rem; gap: 1.2rem; overflow-x: auto; }
  header.masthead { padding: 3rem 0 1.8rem; }
  .statstrip { grid-template-columns: repeat(2, 1fr); }
}
"""

FONTS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..650'
    '&family=IBM+Plex+Sans:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">'
)


def esc(value: str) -> str:
    """HTML-escape a value."""
    return html.escape(str(value))


def read_tsv(path: Path) -> list[list[str]]:
    """Read a TSV file into rows; empty list when the file is missing."""
    if not path.exists():
        return []
    with path.open() as f:
        return list(csv.reader(f, delimiter="\t"))


def fmt_count(value: str) -> str:
    """Format an integer-ish count with thousands separators; pass through non-numbers."""
    try:
        return f"{float(value):,.0f}"
    except ValueError:
        return value


def fmt_sig(value: str, digits: int = 3) -> str:
    """Format a numeric string to `digits` significant digits; pass through non-numbers."""
    try:
        f = float(value)
    except ValueError:
        return value
    return "0" if f == 0 else f"{f:.{digits}g}"


def fmt_ratio(value: str) -> str:
    """Format a ratio to 4 decimals; pass through non-numbers (NO_DATA, ERR, -, ?)."""
    try:
        return f"{float(value):.4f}"
    except ValueError:
        return value


def human_duration(seconds: str) -> str:
    """Render seconds as a human duration (6s, 14m, 3.2h, 574d)."""
    try:
        s = float(seconds)
    except ValueError:
        return seconds
    if s < 60:
        return f"{s:.0f}s"
    if s < 3600:
        return f"{s / 60:.0f}m"
    if s < 86400:
        return f"{s / 3600:.1f}h"
    return f"{s / 86400:.0f}d"


def spark(values: list[float], width: int = 140, height: int = 26) -> str:
    """Render values as an inline SVG bar sparkline (oldest left)."""
    if not values:
        return ""
    peak = max(values) or 1
    bar_w = width / len(values)
    bars = []
    for i, v in enumerate(values):
        bar_h = max(1, round(v / peak * (height - 2)))
        color = "var(--accent)" if v == peak and peak > 0 else "var(--bar)"
        bars.append(
            f'<rect x="{i * bar_w + 1:.1f}" y="{height - bar_h}" width="{max(bar_w - 2, 1):.1f}" '
            f'height="{bar_h}" fill="{color}"><title>{v:g}</title></rect>'
        )
    return f'<svg width="{width}" height="{height}">{"".join(bars)}</svg>'


def flag_badges(flags: str) -> str:
    """Render a comma-separated flag string as colored badges."""
    styles = {"BREACH": "bad", "DEGRADED": "warn", "BACKLOG": "warn", "UNASSIGNED": "bad",
              "NO_DATA": "info", "ERR": "bad", "NEW": "info", "GONE": "info", "DELTA": "warn"}
    return " ".join(f'<span class="badge {styles.get(f, "info")}">{esc(f)}</span>' for f in flags.split(",") if f)


def th(label: str, unit: str = "", num: bool = False) -> str:
    """Render a table header cell with an optional unit annotation."""
    unit_html = f' <span class="u">{esc(unit)}</span>' if unit else ""
    cls = ' class="num"' if num else ""
    return f"<th{cls}>{esc(label)}{unit_html}</th>"


def table(header: str, rows: list[str]) -> str:
    """Assemble an HTML table from pre-rendered header cells and <tr> rows."""
    if not rows:
        return '<p class="muted">no data</p>'
    return f"<table><thead><tr>{header}</tr></thead><tbody>{''.join(rows)}</tbody></table>"


def scalyr_link(app: str, message: str = "") -> str:
    """Build a Scalyr events URL pre-filtered to one app's production errors.

    With `message`, adds a full-text search term for the message so the link
    lands on exactly those lines (field-agnostic, works for message_ and log).
    """
    filter_ = f"{SCALYR_ERROR_FILTER} application='{app}'"
    if message:
        term = message[:120].replace("\\", "\\\\").replace('"', '\\"')
        filter_ += f' "{term}"'
    return f"https://app.eu.scalyr.com/events?filter={urllib.parse.quote(filter_)}&startTime=7d"


def load_findings(dump: Path) -> dict:
    """Load findings.json; empty structure when the agent has not analyzed yet."""
    path = dump / "findings.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def render_findings(findings: dict, section: str) -> str:
    """Render the agent findings assigned to one data section."""
    blocks = []
    for f in findings.get("findings", []):
        if f.get("section") != section:
            continue
        ticket = f.get("ticket")
        ticket_html = f'<div class="meta">proposed ticket <b>{esc(ticket["id"])}</b>: {esc(ticket["summary"])}</div>' if ticket else ""
        evidence = f'<div class="meta">{esc(f["evidence"])}</div>' if f.get("evidence") else ""
        blocks.append(
            f'<div class="finding v-{esc(f.get("verdict", "info"))}">'
            f'<span class="fid">{esc(f["id"])}</span><span class="badge info">{esc(f.get("verdict", "?"))}</span> '
            f'<b>{esc(f.get("subject", ""))}</b> — {esc(f["summary"])}{evidence}{ticket_html}</div>'
        )
    return "".join(blocks)


def section_slos(dump: Path, findings: dict) -> str:
    """SLO table: raw vs prev week vs official Nobl9 status, error-day sparklines."""
    rows = read_tsv(dump / "slo_ratios.tsv")
    if not rows:
        return '<p class="muted">slo_ratios.tsv missing</p>'
    projects = {s["metadata"]["name"]: s["metadata"]["project"] for s in json.loads((dump / "slos.json").read_text())} if (dump / "slos.json").exists() else {}
    error_days = {r[0]: r[2] for r in read_tsv(dump / "slo_error_days.tsv")}

    out = []
    for name, uuid, target, counts, ratio, prev_counts, prev_ratio, official, budget, burn, flags in rows[1:]:
        link = f'<a href="https://app.nobl9.com/slo/overview/{projects.get(uuid, "")}/{uuid}?org=zalando">{esc(name)}</a>'
        days_spark = ""
        if name in error_days:
            values = [float(p.split("=")[1]) if p.split("=")[1] not in ("absent", "NaN") else 0.0 for p in error_days[name].split(",")]
            days_spark = spark(list(reversed(values)))
        cls = ' class="flagged"' if flags else ""
        out.append(
            f"<tr{cls}><td>{link}</td><td class='num'>{esc(fmt_ratio(target))}</td>"
            f"<td class='num'>{esc(counts)} · {esc(fmt_ratio(ratio))}</td>"
            f"<td class='num'>{esc(prev_counts)} · {esc(fmt_ratio(prev_ratio))}</td>"
            f"<td class='num'>{esc(fmt_ratio(official))}</td><td class='num'>{esc(fmt_sig(budget))}</td>"
            f"<td class='num'>{esc(fmt_sig(burn))}</td>"
            f"<td>{days_spark}</td><td>{flag_badges(flags)}</td></tr>"
        )
    header = (
        th("SLO") + th("target", "ratio", num=True) + th("this week", "good/total ops", num=True)
        + th("prev week", "good/total ops", num=True) + th("official", "Nobl9 reliability", num=True)
        + th("budget left", "%", num=True) + th("burn", "× rate", num=True)
        + th("errors/day", "7d, old→new") + th("flags")
    )
    return (
        f'<p class="srclinks"><a href="{NOBL9_DASHBOARD}">Nobl9 dashboard</a> · raw = literal 7d recount of the SLO query · official = what Nobl9 shows the team</p>'
        + table(header, out)
        + render_findings(findings, "slos")
    )


def section_nobl9_alerts(dump: Path, findings: dict) -> str:
    """Nobl9 fired-alert list (usually empty)."""
    path = dump / "nobl9_alerts.json"
    alerts = json.loads(path.read_text()) if path.exists() else []
    if not alerts:
        return '<p class="muted">no Nobl9 alerts fired for our SLOs this window</p>' + render_findings(findings, "nobl9_alerts")
    out = [
        f"<tr><td>{esc(a['spec']['slo']['name'])}</td><td>{esc(a['spec'].get('severity', '?'))}</td>"
        f"<td class='num'>{esc(a['spec'].get('triggeredClockTime', a['spec'].get('triggeredMetricTime', '?')))}</td>"
        f"<td>{esc(a['spec'].get('status', '?'))}</td></tr>"
        for a in alerts
    ]
    return table(th("SLO") + th("severity") + th("triggered", "UTC", num=True) + th("status"), out) + render_findings(findings, "nobl9_alerts")


def section_alerts(dump: Path, findings: dict) -> str:
    """dash0-config alert rules evaluated over 7d vs threshold, with prev week."""
    rows = read_tsv(dump / "alert_eval.tsv")
    if not rows:
        return '<p class="muted">alert_eval.tsv missing</p>'
    nodata = {}
    for name, metric, v7, v90 in read_tsv(dump / "alert_nodata.tsv"):
        nodata.setdefault(name, []).append(f"{metric}: {v7}, {v90}")

    out = []
    for name, threshold, value, prev, source in rows[1:]:
        state = ""
        if value == "IGNORED":
            state = '<span class="badge info">IGNORED</span>'
            value = "-"
        elif value in ("absent", "NaN"):
            state = '<span class="badge warn">NO_DATA</span>'
            value = "-"
        elif threshold not in ("?", "-") and float(value) > float(threshold):
            state = '<span class="badge bad">OVER</span>'
        probes = "<br>".join(esc(p) for p in nodata.get(name, []))
        probes_html = f"<details><summary>metric probes</summary><div>{probes}</div></details>" if probes else ""
        out.append(
            f"<tr><td>{esc(name)}{probes_html}</td><td class='num'>{esc(threshold)}</td>"
            f"<td class='num'>{esc(fmt_sig(value))}</td><td class='num'>{esc(fmt_sig(prev))}</td><td>{state}</td>"
            f"<td><a href='{DASH0_CONFIG_GITHUB}/{esc(source)}'>{esc(source)}</a></td></tr>"
        )
    header = (
        th("alert") + th("threshold", num=True) + th("value", "7d", num=True)
        + th("value", "prev 7d", num=True) + th("state") + th("source")
    )
    return (
        '<p class="srclinks">unit follows each rule\'s expression — mostly error ratio, some raw counts</p>'
        + table(header, out) + render_findings(findings, "alerts")
    )


def section_scalyr(dump: Path, findings: dict) -> str:
    """Per-app ERROR log counts with week-over-week bars and logger facets."""
    rows = read_tsv(dump / "scalyr_counts.tsv")
    if not rows:
        return '<p class="muted">scalyr_counts.tsv missing</p>'
    out = []
    for app, this_week, last_week in rows[1:]:
        values = [float(v) if v not in ("ERR",) else 0.0 for v in (last_week, this_week)]
        messages = ""
        src = dump / "scalyr_messages" / f"{app}.csv"
        if src.exists() and len(lines := list(csv.reader(src.open()))) > 1:
            body = "<br>".join(
                f"{esc(c)} × <a href='{scalyr_link(app, m)}'>{esc(m[:160])}</a>"
                for c, m, *_ in lines[1:] if m
            )
            messages = f"<details><summary>top messages</summary><div>{body}</div></details>"
        out.append(
            f"<tr><td><a href='{scalyr_link(app)}'>{esc(app)}</a>{messages}</td>"
            f"<td class='num'>{esc(fmt_count(this_week))}</td><td class='num'>{esc(fmt_count(last_week))}</td>"
            f"<td>{spark(values, width=60)}</td></tr>"
        )
    header = (
        th("application") + th("this week", "ERROR lines", num=True)
        + th("last week", "ERROR lines", num=True) + th("trend", "prev → now")
    )
    return (
        '<p class="srclinks">top messages = facet on the parsed message fields (message_ / log), stack traces excluded</p>'
        + table(header, out) + render_findings(findings, "scalyr")
    )


def section_nakadi(dump: Path, findings: dict, history: dict[tuple[str, str], list[float]]) -> str:
    """Nakadi subscription backlogs with cross-dump history sparklines."""
    rows = read_tsv(dump / "nakadi_stats.tsv")
    if not rows:
        return '<p class="muted">nakadi_stats.tsv missing</p>'
    out = []
    for app, event_type, sub_id, unconsumed, max_lag, assigned, prev, flags in rows[1:]:
        cls = ' class="flagged"' if flags else ""
        out.append(
            f"<tr{cls}><td>{esc(app)}<br><span class='subid'>{esc(event_type)} · {esc(sub_id[:8])}</span></td>"
            f"<td class='num'>{esc(fmt_count(unconsumed))}</td><td class='num'>{esc(human_duration(max_lag))}</td>"
            f"<td class='num'>{esc(assigned)}</td><td>{spark(history.get((sub_id, event_type), []), width=80)}</td>"
            f"<td>{flag_badges(flags)}</td></tr>"
        )
    header = (
        th("app / event type") + th("unconsumed", "events", num=True) + th("max lag", num=True)
        + th("assigned", "partitions", num=True) + th("history", "per dump") + th("flags")
    )
    return table(header, out) + render_findings(findings, "nakadi")


def section_costs(dump: Path, findings: dict, history: dict[str, list[float]]) -> str:
    """Cost diff vs previous dump with cross-dump history sparklines."""
    rows = read_tsv(dump / "costs_diff.tsv")
    if not rows:
        return '<p class="muted">costs_diff.tsv missing (first run has no baseline)</p>' + render_findings(findings, "costs")
    out = []
    for app, prev, cost, flag in rows[1:]:
        cls = ' class="flagged"' if flag else ""
        out.append(
            f"<tr{cls}><td>{esc(app)}</td><td class='num'>{esc(fmt_count(prev))}</td><td class='num'>{esc(fmt_count(cost))}</td>"
            f"<td>{spark(history.get(app, []), width=80)}</td><td>{flag_badges(flag)}</td></tr>"
        )
    header = (
        th("application") + th("prev", "USD/month", num=True) + th("now", "USD/month", num=True)
        + th("history", "per dump") + th("flags")
    )
    return (
        f'<p class="srclinks"><a href="{KRR_TEAM_PAGE}">kube-resource-report team page</a> · monthly cost snapshot, diffed against the previous dump</p>'
        + table(header, out)
        + render_findings(findings, "costs")
    )


def collect_history() -> tuple[dict[str, list[float]], dict[tuple[str, str], list[float]]]:
    """Collect per-app cost and per-subscription backlog series across all dumps."""
    costs: dict[str, list[float]] = {}
    nakadi: dict[tuple[str, str], list[float]] = {}
    for dump in sorted(WORM_ROOT.glob("[0-9]*")):
        for row in read_tsv(dump / "costs.tsv")[1:]:
            costs.setdefault(row[0], []).append(float(row[8]))
        for row in read_tsv(dump / "nakadi_stats.tsv")[1:]:
            nakadi.setdefault((row[2], row[1]), []).append(float(row[3]))
    return costs, nakadi


def stat_strip(dump: Path) -> str:
    """Compute the masthead stat strip from dump data — real numbers only."""
    slo_rows = read_tsv(dump / "slo_ratios.tsv")[1:]
    alert_rows = read_tsv(dump / "alert_eval.tsv")[1:]
    scalyr_rows = read_tsv(dump / "scalyr_counts.tsv")[1:]
    nakadi_rows = read_tsv(dump / "nakadi_stats.tsv")[1:]
    cost_rows = read_tsv(dump / "costs_diff.tsv")[1:]

    def stat(n: str, label: str, hot: bool) -> str:
        return f'<div><div class="n{" hot" if hot else ""}">{esc(n)}</div><div class="l">{esc(label)}</div></div>'

    breaches = sum(1 for r in slo_rows if "BREACH" in r[10])
    degraded = sum(1 for r in slo_rows if "DEGRADED" in r[10])
    over = sum(1 for r in alert_rows if r[2] not in ("IGNORED", "absent", "NaN") and r[1] not in ("?", "-") and float(r[2]) > float(r[1]))
    errors = sum(float(r[1]) for r in scalyr_rows if r[1] != "ERR")
    prev_errors = sum(float(r[2]) for r in scalyr_rows if r[2] != "ERR")
    flagged_subs = sum(1 for r in nakadi_rows if r[7])
    cost_flags = sum(1 for r in cost_rows if r[3])
    return '<div class="statstrip">' + "".join([
        stat(str(breaches), "SLO breaches", breaches > 0),
        stat(str(degraded), "SLOs degraded", degraded > 0),
        stat(str(over), "alerts over threshold", over > 0),
        stat(f"{errors:,.0f}", "ERROR lines · 7d", False),
        stat(f"{prev_errors:,.0f}", "ERROR lines · prev 7d", False),
        stat(str(flagged_subs), "Nakadi subs flagged", flagged_subs > 0),
        stat(str(cost_flags), "cost flags", cost_flags > 0),
    ]) + "</div>"


def render(dump: Path) -> str:
    """Assemble the full report HTML for one dump directory."""
    findings = load_findings(dump)
    cost_history, nakadi_history = collect_history()

    if findings:
        overview = f'<p class="summary">{esc(findings.get("summary", ""))}</p>'
        tickets = [f["ticket"] for f in findings.get("findings", []) if f.get("ticket")]
        if tickets:
            ticket_rows = [
                f"<tr><td class='num'><b>{esc(t['id'])}</b></td><td>{esc(t['summary'])}</td><td>{esc(t.get('description', ''))}</td></tr>"
                for t in tickets
            ]
            overview += (
                "<section id='tickets'><h2><span class='no'>00</span>Proposed tickets"
                " <span class='badge warn'>pending approval — never auto-created</span></h2>"
                + table(th("id") + th("summary") + th("description"), ticket_rows) + "</section>"
            )
    else:
        overview = '<div class="pending">No findings.json yet — data only, analysis pending.</div>'

    errors = (dump / "_errors.log").read_text().strip() if (dump / "_errors.log").exists() else ""
    errors_html = f"<section><h2><span class='no'>!!</span>Fetch errors</h2><div class='errlog'>{esc(errors)}</div></section>" if errors else ""

    sections = [
        ("slos", "SLOs"),
        ("nobl9-alerts", "Nobl9 alerts fired"),
        ("alerts", "Alert rules"),
        ("errors", "Error logs"),
        ("nakadi", "Nakadi subscriptions"),
        ("costs", "Costs"),
    ]
    contents = [
        section_slos(dump, findings),
        section_nobl9_alerts(dump, findings),
        section_alerts(dump, findings),
        section_scalyr(dump, findings),
        section_nakadi(dump, findings, nakadi_history),
        section_costs(dump, findings, cost_history),
    ]
    nav = '<nav><span class="brand">WORM</span>' + "".join(
        f'<a href="#{sid}">{esc(title)}</a>' for (sid, title), _ in zip(sections, contents)
    ) + f'<a href="{GRAFANA_DASHBOARD}">Grafana ↗</a></nav>'
    body = "".join(
        f'<section id="{sid}"><h2><span class="no">{i + 1:02d}</span>{esc(title)}</h2>{content}</section>'
        for i, ((sid, title), content) in enumerate(zip(sections, contents))
    )
    return (
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"<title>WORM review {esc(dump.name)}</title>{FONTS}<style>{CSS}</style></head><body>"
        "<!-- Hallmark · macrostructure: Ledger · theme: custom (warm paper · oxblood · Fraunces/IBM Plex Sans/JetBrains Mono) · P4 H4 E4 S4 R5 V4 -->"
        f"{nav}<main><header class='masthead'><h1>Operational Review</h1>"
        f"<div class='dateline'>team Thunder · dump {esc(dump.name)} · Score Cards: manual check (browser auth)</div>"
        f"</header>{stat_strip(dump)}{overview}{errors_html}{body}</main></body></html>"
    )


def main() -> int:
    """Render report.html for the given (or newest) dump directory."""
    if len(sys.argv) > 1:
        dump = Path(sys.argv[1])
    else:
        dumps = sorted(WORM_ROOT.glob("[0-9]*"))
        if not dumps:
            print(f"no dump directories under {WORM_ROOT}", file=sys.stderr)
            return 1
        dump = dumps[-1]
    out = dump / "report.html"
    out.write_text(render(dump))
    print(f"[worm-report] {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
