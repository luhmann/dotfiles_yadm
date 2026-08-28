## Service Tokens

For Zalando API tests that need service/internal scopes, use the Greyhound
helper checked out at `~/dev/z/frschulze-greyhound`:

```shell
cd ~/dev/z/frschulze-greyhound
TOKEN="$(./greyhound.sh -s | jq -r '.access_token')"
```

Use this instead of regular user tokens when internal scopes are required.

When user tokens are required you can use `ztoken --help`

## Maven / Build 403 errors

A `403 Forbidden` from maven.zalando.net during a build usually means the
VPN is disconnected — it is not a problem with the change. Ping me to
reconnect, then retry with `-U` (Maven caches the failed resolution in the
local repository until forced).

## Nakadi CLI

- A global `nakadictl --help` tool is available on PATH for investigating Zalando Nakadi events.

## Dash0

- A global `dash0` CLI is available for querying spans, metrics (PromQL),
  traces, logs, check rules, and dashboards. Use `dash0 --help`.
- Alert definitions, dashboards, and signal-to-metrics configs are managed
  as code in https://github.com/zalando-build/dash0-config, checked out at
  `~/dev/z/dash0-config` (organized by TOER org, e.g. `pt/`; legacy configs
  live under `migration/`). Search there for s2m metric names (`s2m.<id>.red`),
  alert queries, and SLO metric sources — some API endpoints (e.g.
  `/api/signal-to-metrics/configs`) require org admin and will 403.

## Sunrise CLI

- `sunrise-cli --help` is available to answer lot of internal infrastructure questions, eg to see available APIs and there interfaces
- includes infos about teams, cdp build status, can answer questions against the zalando documentation
