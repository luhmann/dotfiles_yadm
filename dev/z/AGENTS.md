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

## Scalyr (application logs)

- Application logs live in Scalyr, not Dash0 (Dash0 only has spans/metrics for
  our services). Use the global `scalyr` CLI (`scalyr --help`); server and token
  come from the `scalyr_server` / `scalyr_readlog_token` env vars.
- Filter by `$application`, `$environment`, `$component`; useful fields are
  `level`, `logger`, `message_`, `pod`, `version` (CDP build, e.g. `master-446`):

```shell
scalyr power-query "\$application == 'block-orders' \$environment == 'live' \$component == 'block-orders-backend' level == 'ERROR' | group n=count() by version, logger" --start 24h --output csv
```

## Sunrise CLI

- `sunrise-cli --help` is available to answer lot of internal infrastructure questions, eg to see available APIs and there interfaces
- includes infos about teams, cdp build status, can answer questions against the zalando documentation

## PR Review Requests

- `$PR_REVIEW_WEBHOOK_URL` is a Google Chat webhook for the PR-review channel. Draft the message and get my approval before posting. Start the message with `From Florian:`, keep it concise and professional with no emojis, and link the PR as `<url|repo#123>`. Post with `jq -n --arg text "$msg" '{text: $text}' | curl -sS -X POST -H 'Content-Type: application/json; charset=UTF-8' --data @- "$PR_REVIEW_WEBHOOK_URL"`.
