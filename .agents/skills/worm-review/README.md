# worm-review

Automates the data collection and analysis for team Thunder's bi-weekly
operational review meeting (WORM). Instead of clicking through Nobl9,
Scalyr, Dash0, Grafana, Nakadi and the cost report live in the meeting,
an agent prepares the findings beforehand; the meeting discusses the 2–3
real anomalies instead of discovering them.

## Parts

| File | Role |
|---|---|
| `worm_fetch.py` | Deterministic fetcher. Pulls all sources into a dated dump dir. Flags mechanically (DEGRADED, BREACH, BACKLOG, DELTA, NO_DATA) but never judges. |
| `worm_report.py` | Deterministic renderer. Turns a dump dir into a self-contained `report.html`: all data as tables + SVG sparklines + drill-down links, with the agent's `findings.json` verdicts inline per section. |
| `SKILL.md` | Agent instructions: how to run the fetch, triage each artifact, drill down, judge actionability, and produce the review. |
| `worm/known_issues.md` (in the scratch workspace) | Verdict memory across runs — recurring noise classified once, matched first every run. |
| `worm/<YYYY_MM_DD>/` (in the scratch workspace) | One dump per run: raw artifacts + the final `review.md`. Doubles as snapshot history for sources that have none. |

Split rationale: everything mechanical and reproducible lives in the
script (fix a source change once, in code); everything requiring judgment
lives in the skill text (the agent's job).

## Intended usage

Once per review cycle, ideally the day before the meeting, open a fresh
agent session and say **"prepare the WORM review"**. The skill drives
three phases:

1. **Fetch** (~5 min): run `worm_fetch.py` → `worm/<date>/` with SLO
   ratios (raw Dash0 recount + official Nobl9 status), Nobl9 alert
   history, all dash0-config Thunder alert rules evaluated over 7d,
   per-app Scalyr ERROR counts + top-message facets, Nakadi subscription
   backlogs, and kube-resource-report costs. Week-over-week context via
   `offset 7d` where the source has history, dump-diff where it doesn't.
   `_errors.log` records degraded sources.
2. **Analyze**: match every flag against `known_issues.md` first, drill
   into what's left (per-source recipes in SKILL.md), judge: real
   regression vs telemetry rot vs one-off blip vs known issue.
3. **Output**: `findings.json` (structured verdicts: F-ids, sections,
   action/watch/noise/known-issue, T-id ticket proposals) rendered into
   `report.html` via `worm_report.py` — the human-review artifact where
   data and agent reasoning sit side by side — plus `review.md` with the
   WORM template table paste-ready for the Google doc, and an updated
   `known_issues.md`. Tickets are **never auto-created**; after review the
   agent creates exactly the approved T-ids and writes the PT keys back.

The report/data split mirrors the fetch/skill split: `worm_report.py`
generates all data sections deterministically from the TSVs, so the
report always shows the complete data the agent saw — an agent
hand-writing HTML could silently omit rows. The agent contributes only
`findings.json`.

The human opens `report.html`, checks the verdicts against the adjacent
data, copies the table rows into the WORM Google doc (the workspace MCP
has no Docs write tools — manual paste), approves or rejects ticket
proposals by T-id, and makes the calls the agent only surfaces:
declaring an alert dead (`IGNORED_ALERTS`), deleting subscriptions,
cleaning up dash0-config.

## Design decisions worth remembering

- **Raw SLO recount AND official Nobl9 status.** Nobl9's minute-sampled
  extrapolation can report reliability 1.0 while real ERROR spans exist.
  Raw ratio = discovery trigger (DEGRADED); official = reportable status
  (BREACH). Never present the raw ratio as the SLO status.
- **SLO drill-down and Scalyr logs are complementary, not redundant**
  (tested): failed requests can log zero ERROR lines, and ERROR logs can
  come from requests with healthy spans; background consumers have no
  SLO coverage at all.
- **App list from the Sunrise API at runtime**, not hardcoded — a
  hand-picked list once missed the noisiest app and included a
  nonexistent one. Zero-count rows for registered apps are informative.
- **Nakadi stats fetched from the Nakadi API directly**, not via the
  ZMON check / Grafana panel that wraps it. Grafana dashboards are
  renderings, not sources.
- **Snapshot-only sources (costs, Nakadi) build history through the
  dumps.** The fetch logs baseline age and warns when >10d (missed runs
  make diffs span multiple cycles).
- **Scorecards are not machine-fetchable** (browser login) — permanent
  manual row.

## Feedback loops

- `known_issues.md` keeps run N+1 cheaper than run N.
- Previous dumps' `review.md` let a session check what last week
  concluded.
- Systematic gaps found during a review (missing source, wrong app
  list) get fixed in `worm_fetch.py` once — the pair accretes
  operational knowledge as executable code, the way the WORM doc
  history did as prose.

## Config

Env knobs (defaults in `worm_fetch.py`): `WORM_ROOT`, `DASH0_CONFIG`
(clone of zalando-build/dash0-config), `NOBL9_ORG`. Requires on PATH:
`sloctl`, `dash0`, `scalyr`, `ztoken`, `curl`. Nobl9 REST credentials
are read from `~/.config/nobl9/config.toml`.
