---
name: worm-review
description: >
  Run the team Thunder WORM (BiWeekly Operational Review Meeting) analysis.
  Use when the user asks to "run the worm review", "prepare WORM",
  "check SLOs and errors for the week", or wants the operational review
  data fetched and analyzed. Fetches SLO ratios, Dash0 alert evaluations,
  Scalyr error counts, and infra costs, then produces a filled-in review
  table with classified findings and proposed (never auto-created) Jira tickets.
---

# WORM review

Two-phase workflow: deterministic fetch, then judgment-based analysis.
Output goes into the WORM doc template table
(doc `1maH4S8MvEOpbR_fX3ytWqKbIC5qm2hTauEUH6tQMIvg`).

## Phase 1: Fetch

```bash
python3 ~/.agents/skills/worm-review/worm_fetch.py
```

Writes to `~/icloud/org/_scratch/purchase-orders-management/worm/<YYYY_MM_DD>/`
(override root with `WORM_ROOT`). Check `_errors.log` first — per-source
failures are non-fatal, a partial dump is still analyzable. Runtime ~1 min.

| File | Content |
|---|---|
| `slo_ratios.tsv` | name, uuid, target, raw good/total + ratio (this + prev week), official Nobl9 reliability/budget/burn rate, flags |
| `slo_error_days.tsv` | per DEGRADED SLO: which days the errors happened (drill-down seed) |
| `nobl9_alerts.json` | Nobl9 alerts matching Purchasing SLOs (~10d history max) |
| `alert_eval.tsv` | each dash0-config Thunder alert expr evaluated over 7d vs threshold, plus previous week's value |
| `alert_nodata.tsv` | alerts whose metrics are absent: 7d and 90d probes |
| `scalyr_counts.tsv` | per-app ERROR counts, this week vs last week |
| `scalyr_messages/<app>.csv` | top error messages per app (merged `message_` + `log` facets) |
| `nakadi_stats.tsv` | per team-app Nakadi subscription: unconsumed events, max lag, partition assignment, prev dump value |
| `costs.tsv`, `costs_diff.tsv` | kube-resource-report team rows + NEW/DELTA/GONE diff |

## Phase 2: Analyze

Read `worm/known_issues.md` FIRST. Match every finding against it before
investigating — most weekly noise is already classified there.

### SLO findings (`slo_ratios.tsv` + `slo_error_days.tsv`)

Two flags, different meanings — don't conflate them:
- **BREACH** = Nobl9's official reliability (Status API v2, same number as
  the UI) is below target. This is what goes in the WORM template's SLO
  column.
- **DEGRADED** = the raw 7d event count of the SLO's own metric has errors
  pushing the literal ratio below target. Nobl9's minute-sampled smoothing
  often reports reliability 1.0 while real ERROR spans exist — DEGRADED is
  the *discovery* trigger: always drill into these errors even when there
  is no BREACH. Report as "N failed operations", not as an SLO breach.
- Low denominators (< ~50/wk) flag DEGRADED on 1–2 errors — report the errors, not the %.
- Drill down per error day (span queries **time out on 7d windows**, use the
  day from `slo_error_days.tsv`):
  ```bash
  dash0 spans query --filter "service.name is <svc>" \
    --filter "otel.span.name is <span>" \
    --filter "otel.span.status.code is ERROR" \
    --from now-Nd --to now-Md --limit 10 -o json
  ```
  JSON is OTLP-shaped: `.resourceSpans[].scopeSpans[].spans[]`;
  `http.status_code` lives in span `attributes`. Table output (`no -o`) is
  easier for eyeballing.
- s2m id → service/span filter mapping: `~/dev/z/dash0-config/{pt,migration}/signal-to-metrics/`
  (filters use `.value` for `is`, `.values` for `is_one_of`).

### Alert no-data triage (`alert_nodata.tsv`)

Distinguish three cases for metrics absent at 90d:

1. **Broken s2m filter** — compare against the sibling *SLO* s2m config for
   the same operation in dash0-config; stale service names
   (`web-order-backend` vs `web-order/web-order-backend`) and stale span
   names are the known failure mode.
2. **Service not instrumented** — no spans under any name in Dash0, but
   active per Scalyr log volume.
3. **Emit-on-failure counter** — absent is healthy. Verify by reading the
   emitting code (e.g. POC `publish.events.failed` →
   `FailSafeNakadiPublisher.handleError`). Record verdict in known_issues.md
   so this is never re-investigated.

`NaN` in `alert_eval.tsv` = 0/0 for the week (no traffic) — usually fine,
only escalate if the operation should have traffic.

`IGNORED` = alert is on the `IGNORED_ALERTS` list in `worm_fetch.py`:
decommissioned operations whose Dash0 rules are still `enabled: true`
(Dash0 has no machine-readable "in use" marker — verified 2026-07-16).
If the team deletes these from dash0-config, drop them from the list.

### Scalyr errors (`scalyr_counts.tsv` + `scalyr_messages/`)

- Investigate week-over-week spikes in BOTH directions — a big *previous*
  week means something happened that the last session may have missed.
  (Same applies to the prev-week columns in `slo_ratios.tsv` and
  `alert_eval.tsv`.)
- `scalyr_messages/<app>.csv` groups by *parsed message* — the clean text
  lives in `message_` (JSON logback) or `log` (scala apps) depending on
  the app's logging setup; the raw `message` field is useless for
  grouping (timestamps/threads make every line unique). Messages that
  embed IDs/eids still split into near-duplicates — cluster those
  mentally or via substring query.
- To sample full lines (incl. stack traces) for a message:
  ```bash
  scalyr query "<filter> application='<app>' 'substring of message'" --start 7d --count 3
  ```
- Filter is strict-positional: filter string right after `query`, flags after.

### Nakadi backlogs (`nakadi_stats.tsv`)

Flags: BACKLOG (unconsumed > 100), UNASSIGNED (no partition has a consumer).
- BACKLOG + growing vs prev_unconsumed → consumer is falling behind or stuck
  (historically one of the team's most operationally relevant findings).
- UNASSIGNED + huge backlog that never moves → likely a stale/abandoned
  subscription, not an outage — candidate for a cleanup ticket, check
  known_issues first.
- Source is snapshot-only: a spike that recovered mid-week is invisible;
  prev_unconsumed comes from the previous dump.

### Costs (`costs_diff.tsv`)

Flags: NEW (app appeared), GONE (disappeared), DELTA (>20% change).
Platform-wide spikes affecting all teams are known noise (see known_issues).
Diff baselines come from the previous dump — the fetch log warns when the
baseline is >10d old (missed runs make deltas span multiple cycles).

## Phase 3: Output

1. Write `findings.json` into the dump dir — the structured verdicts that
   the HTML report renders next to the raw data:

   ```json
   {
     "summary": "one-line overall verdict",
     "findings": [
       {
         "id": "F1",
         "section": "slos|nobl9_alerts|alerts|scalyr|nakadi|costs",
         "subject": "what it is about (SLO name, app, alert, …)",
         "verdict": "action|watch|noise|known-issue",
         "summary": "what happened and why it matters",
         "evidence": "drill-down facts: day, span, logger, trace …",
         "ticket": {"id": "T1", "summary": "…", "description": "…"}
       }
     ]
   }
   ```

   `ticket` only on findings that warrant one (verdict `action`). Ticket
   ids are stable (T1, T2…) so the user can approve by id.
2. Render the HTML report and tell the user to open it:

   ```bash
   python3 ~/.agents/skills/worm-review/worm_report.py <dump_dir>
   ```

   `report.html` is self-contained: all dump data as tables with
   drill-down links + sparklines, findings inline per section, proposed
   tickets up top. Data sections are script-generated — never hand-write
   the HTML; if data is missing fix the dump or the report script.
3. Write `review.md` into the dump dir: the WORM template table
   (SLOs / Alerts / Error Logs / Score Cards / Grafana / Cost rows —
   Score Cards is always "manual check", browser-auth only) with rows
   paste-ready for the Google doc, a "Proposed tickets" section, and a
   "Known-issue matches" section.
4. **Update `known_issues.md`** with new verdicts and remove/annotate
   resolved ones. This is the memory that keeps weekly runs cheap.
5. **Never create Jira tickets.** Dedupe candidates first
   (`jira issue list --plain -q 'project = PT AND summary ~ "..."'`
   — use `--order-by created`, `ORDER BY` inside JQL breaks), then present
   proposals for approval by T-id. After the human reviewed the report:
   create exactly the approved tickets and write the created PT keys back
   into `review.md` and `known_issues.md`.
6. Do not write to the Google doc, Jira, or any other non-local resource
   unless explicitly asked. The workspace MCP has no Docs write tools —
   updating the WORM doc is manual paste from `review.md`.

## Gotchas

- `dash0 metrics instant -o json` + jq — the `--column value` CSV path
  returns empty values.
- When evaluating alert exprs manually, widen ALL range windows
  (`\[\d+[smhd]\]`) — a missed `[30m]` caused a false NO_DATA once.
- Cumulative OTel counters + `!= 0` alerts keep firing until pod restart
  after the first increment.
- `sloctl get alerts` history caps at ~1000 entries (~10 days).
- Scorecards (sunrise tech-insights) are not machine-fetchable (browser
  login only) — always a manual row.
