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

- A global `nakadi-cli` tool is available on PATH for investigating Zalando Nakadi events.
- Use `nakadi-cli --help` for command and option details.
- Auth can be provided via `--token`, `NAKADI_TOKEN`, or `ztoken`.
- The tool cannot be used to publish events.

## Dash0

- A global `dash0` CLI is available for querying spans, metrics (PromQL),
  traces, logs, check rules, and dashboards. Use `dash0 --help`.
- Alert definitions, dashboards, and signal-to-metrics configs are managed
  as code in https://github.com/zalando-build/dash0-config, checked out at
  `~/dev/z/dash0-config` (organized by TOER org, e.g. `pt/`; legacy configs
  live under `migration/`). Search there for s2m metric names (`s2m.<id>.red`),
  alert queries, and SLO metric sources — some API endpoints (e.g.
  `/api/signal-to-metrics/configs`) require org admin and will 403.

## API Portal CLI

- A global `api-portal` tool is available on PATH for searching and
  inspecting APIs registered in the Zalando API Portal (apis.zalando.net).
- Commands: `search`, `info`, `routes`, `endpoints` — use `api-portal --help` for details.
- All commands support `--json` for machine-readable output.
- Auth can be provided via `--token`, `ZAPI_TOKEN`, or `ztoken`.
