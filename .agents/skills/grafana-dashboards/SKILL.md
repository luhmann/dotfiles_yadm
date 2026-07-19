---
name: grafana-dashboards
description: >
  Investigate and update Zalando Grafana dashboards. Use when the user
  asks to read, inspect, or modify a Grafana dashboard or panel, add
  metrics/panels, trace how a panel's query changed across versions, or
  query a panel's underlying metrics. Covers the REST-API workflow since
  there is no dedicated Grafana CLI.
---

# Grafana Dashboards

There is **no dedicated Grafana CLI**. All work is done against the
Grafana REST API with `curl`, Bearer auth from `ztoken`, and `jq` for
JSON inspection and splicing.

- Base URL: `https://grafana.zalando.net`
- Auth: `TOKEN=$(ztoken)`, then `-H "Authorization: Bearer $TOKEN"`
- Tools assumed on PATH: `ztoken`, `curl`, `jq`

## Default to investigation first

Reading is non-destructive — start there and confirm the target before
any mutation.

### Key endpoints

- `GET /api/dashboards/uid/<uid>` — full dashboard JSON + `meta`
  (`folderUid`, `version`, `canEdit`, `canAdmin`).
- `GET /api/dashboards/uid/<uid>/versions?limit=N` — saved version
  history, each entry carrying the full dashboard JSON and a `message`.
- `GET /api/datasources/proxy/<id>/api/v1/query` — run a PromQL query
  through a datasource (use `--data-urlencode 'query=...'`).
- `GET /api/user` — identity / `isGrafanaAdmin`.
- `GET /api/folders/<uid>` — folder existence and your rights on it.

### What to look at

- **Structure**: panel list, rows, and **collapsed rows** (their panels
  are nested under `.panels[].panels[]`, easy to miss).
- **Templating vars**: e.g. `$cluster`, `$component`. These often
  default to a staging cluster, so prod-only panels render empty until a
  viewer switches the variable — not a bug.
- **Panel backend**: a single dashboard can mix backends. At Zalando the
  common two are **KairosDB/ZMON** checks (metrics like
  `zmon.check.<id>`, e.g. `zmon.check.10577` for platform container
  CPU/memory) and **Dash0/OTel span PromQL**. Identify which a panel
  uses before reasoning about its query.
- **Query evolution**: to see how a panel changed over time, pull
  `/versions` and compare the panel's `targets` across versions. Match
  panels by **title**, not id — ids and nesting shift between versions.

## Updating a dashboard

Mutations go to `POST /api/dashboards/db` with a payload of the shape:

```
{ "dashboard": <full dashboard JSON>, "folderUid": "<folder>",
  "overwrite": false, "message": "<change summary>" }
```

Follow this sequence:

1. **Back up first.** Pull the current dashboard JSON to `/tmp` (and/or
   the scratch `research/` dir) before changing anything.
2. **Splice locally with `jq`.** Build the new dashboard JSON offline and
   verify it — e.g. panel count, that existing panels are untouched —
   before POSTing.
3. **⚠️ Always include `folderUid`.** Omitting it makes Grafana save the
   dashboard to the **General/root** folder, which moves it out of its
   team folder and changes its permissions — this can lock the team (and
   you) out with 403s. Preserve the original `folderUid` on every write.
4. **Use `overwrite: false`.** If someone bumped the version since you
   pulled it, the write is rejected instead of clobbering their change —
   re-pull, re-splice, retry.
5. **Verify after.** Confirm the version incremented (N → N+1) and that
   `meta.canEdit` is still true.

## Conventions & gotchas

- Legend aliases are plain strings (`usage`, `limit`, `avg`, `max`) — the
  KairosDB plugin does not template them from tags.
- Prefer aggregation (avg/max) over per-entity grouping when pods churn
  (e.g. Karpenter), otherwise legends fill with noisy per-pod entries.
- Some KairosDB ratio metrics (e.g. `cpu.usage_request_ratio`) can return
  empty for sidecars/init containers; the raw `*.usage` keys still work.
- You are typically an **Editor, not a Grafana admin** — actions needing
  admin rights (e.g. editing a dashboard stranded in General root) will
  403. Surface that to the user rather than retrying blindly.

## Safety

Shared dashboards affect whole teams. Before any `POST` that mutates a
shared dashboard, confirm the change with the user and make sure a backup
of the current version exists.
