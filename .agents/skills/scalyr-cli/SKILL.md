---
name: scalyr-cli
description: >
  Query Zalando service logs via the local `scalyr` CLI. Use when
  the user asks to "check scalyr", "search scalyr", "tail logs",
  "find log lines", or wants to verify that a deployed change is
  emitting the expected log messages.
---

# scalyr CLI

Local Python CLI for the Scalyr/DataSet log API. Path: `~/.local/bin/scalyr`.
Server is `eu.scalyr.com` (exported via mise as `scalyr_server`).
Read token is exported as `scalyr_readlog_token`.

## Argument order is strict

The CLI uses positional argument parsing — **the filter must come
right after `query`, before any `--flag`**. This fails:

```bash
scalyr query --start '15m' --count 5 --output multiline 'opa='
# scalyr: error: unrecognized arguments: opa=
```

This works:

```bash
scalyr query 'filter expression' --start '15m' --count 5 --output multiline
```

## Filter syntax is server-side, not a substring

A bare word like `opa=` returns `400 Bad Request: value expected`.
Substring searches must be **quoted literals inside the filter
expression**:

```bash
scalyr query "'opa='" --start '15m' --count 50 --output multiline
```

Outer double quotes keep it as one argv element. Inner single
quotes are part of Scalyr's filter grammar (string literal).

Combine substring with field equality:

```bash
scalyr query "'opa=evaluated' \$component=='purchase-orders-management'" \
  --start '30m' --count 50 --output multiline
```

The `\$` escapes the shell — Scalyr field references start with `$`.

## Useful fields on Zalando log events

Visible as `attributes.*` in the JSON output:

- `$component` — service name, e.g. `purchase-orders-management`
- `$application` — team/app cluster, e.g. `zolaris`
- `$environment` — `release` or `live`
- `$logger` — Java logger FQN
- `$level` — `INFO`, `WARN`, `ERROR`, `TRACE`
- `$pod`, `$namespace`, `$availability_zone`
- `$version` — deployed image tag, e.g. `pr-2615-4`
- `$trace_id`, `$span_id`
- `$timestamp_`, `$message_` — note the trailing underscores;
  these are the parsed-from-JSON fields, distinct from Scalyr's
  built-in `timestamp` / `message`

## Time ranges

`--start` and `--end` accept:

- Relative: `5m`, `1h`, `24h`, `7d`
- Absolute ISO: `2026-05-21T10:00:00`
- Casual: `9am`, `Mon 9am`, `3/1/26`

## Output formats

- `singleline` (default) — one event per line, all attributes dumped after the message. Unreadable for >1 event.
- `multiline` — same fields, line-wrapped per attribute. Better but verbose.
- `json` / `json-pretty` — full API response; pipe through `jq`.

For human-readable output, always use `--output json` + `jq` + `awk`:

```bash
scalyr query "'opa=' \$component=='purchase-orders-management'" \
  --start '30m' --count 100 --output json \
  | jq -r '.matches[] | [.attributes.timestamp_, .attributes.level, .attributes.message_] | @tsv' \
  | awk -F'\t' '{printf "%-25s %-5s %s\n", $1, $2, $3}'
```

With trace_id prefix and pod suffix for request fan-out:

```bash
scalyr query "'opa=' \$component=='purchase-orders-management'" \
  --start '30m' --count 100 --output json \
  | jq -r '.matches[] | [.attributes.timestamp_, .attributes.level, (.attributes.trace_id[0:8]), .attributes.pod[-5:], .attributes.message_] | @tsv' \
  | awk -F'\t' '{printf "%-25s %-5s %s %s  %s\n", $1, $2, $3, $4, $5}'
```

## Other subcommands

- `scalyr tail '<filter>' -n 50` — live tail; same filter rules.
- `scalyr facet-query '<filter>' --field <name> --start 1h` —
  cardinality counts on a field (e.g. distribution of `level`
  for a given service).
- `scalyr numeric-query` / `power-query` — aggregations and
  PowerQuery-style pipelines.

## Common pitfalls

- `--count` max is 5000.
- Default `--count` is 10 — easy to miss matches in a busy service.
- Logs are tail-by-default; use `--mode head` for chronological
  order over a wide range.
- When grepping for a PO code or other token, just wrap it in
  single quotes: `scalyr query "'PO0118835C'" --start 30m ...`.
- A query that returns nothing isn't broken — check the field
  name first: e.g. `$component` not `$service`, `$message_` not
  `$message` for the parsed body.
