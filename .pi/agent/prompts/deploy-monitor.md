---
description: Spawn a cheap read-only subagent that watches a live rollout per the wiki rollout-log-watcher pattern
argument-hint: "[version] [minutes] [model]"
---

The user is deploying the current service. Prepare a monitoring brief and
delegate the watch to a cheap subagent.

Arguments supplied to this template:

`$ARGUMENTS`

1. version: the CDP build version to watch (for example `main-123`). If it is
   not given, the subagent discovers it.
2. minutes: the watch window. Default 30.
3. model: default `anthropic/claude-haiku-5-5`, with effort `low`.

## 1. Gather service facts yourself (do not delegate this)

Read the method first: `~/jcloud/org/wiki/engineering/patterns/rollout-log-watcher.md`
(and `bundle-rollout-watcher.md` if this is an artifact publish rather than a
pod rollout).

From the repo, extract:

- the Scalyr `application` and `component` (from delivery.yaml or the
  `deploy/` manifests);
- the environment value the pipeline passes for prod. Flag it if it differs
  from Scalyr's `live`;
- every other workload in this deployment (CronJobs, sidecars, workers) with
  its own `component`, its schedule, and how it logs;
- what is shipping: the commits since the currently live version. Name the
  risky paths these changes touch. Note any change whose failure would be
  silent in logs (data writes, retention, mappings).

Do not start the watch yourself.

## 2. Spawn the subagent

Use `agent_spawn` with the chosen model and effort. Name it
`deploy-monitor-<component>`. Give it a self-contained task that includes:

- **Hard rules:** read-only. No file edits, no deploy actions, no wiki writes.
  Report once, at the end.
- the method doc and `~/jcloud/org/wiki/scripts/watch-rollout.sh` (run it in
  place, configured via env vars);
- all facts from step 1, with the unverified ones marked;
- these steps, in order:
  1. Verify the vocabulary: facet `environment`, `version`, `level` and
     `container`, including sidecars that log lowercase `error`.
  2. Measure the 24h baseline with the script's own detector expression.
  3. Run the watcher scoped to the new version with `GRACE_MINUTES=5`. New
     pods are silent until they are ready. If the run exits 2 at the end of
     grace, the version never logged: report a possibly stuck rollout. Set
     the bash timeout just above grace plus the window.
  4. If it exits 2 because traffic is bursty, show the per-minute buckets
     instead of retrying blindly.
  5. Report the status of each side workload (most likely "has not run yet").
- the report format: exit code and its meaning, verified env/version,
  baseline, findings (timestamp, pod, logger, message), and the explicit
  limits of a log-only watch.

## 3. Hand back

Tell the user in two or three lines what is being watched, for how long, and
which caveats you found in step 1. Then end your turn. Do not poll the child.
When it reports:

1. Check pods yourself with a single read: restarts, creation time, and
   whether every pod runs the new ReplicaSet. Always pass `--context`
   explicitly (see `~/jcloud/org/wiki/engineering/tools/zkubectl.md`).
2. Summarise. Lead with the verdict, then the findings and the pod state, then
   what the watch could not see: latency, 5xx rates, data correctness, and
   side workloads that have not run yet. The template stays log-only. Do
   not add metrics checks.
