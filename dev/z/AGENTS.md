## Service Tokens

For Zalando API tests that need service/internal scopes, use the Greyhound
helper checked out at `~/dev/z/frschulze-greyhound`:

```shell
cd ~/dev/z/frschulze-greyhound
TOKEN="$(./greyhound.sh -s | jq -r '.access_token')"
```

Use this instead of regular user tokens when internal scopes are required.

When user tokens are required you can use `ztoken --help`

## Nakadi CLI

- A global `nakadi-cli` tool is available on PATH for investigating Zalando Nakadi events.
- Use `nakadi-cli --help` for command and option details.
- Auth can be provided via `--token`, `NAKADI_TOKEN`, or `ztoken`.
- The tool cannot be used to publish events.

## API Portal CLI

- A global `api-portal` tool is available on PATH for searching and
  inspecting APIs registered in the Zalando API Portal (apis.zalando.net).
- Commands: `search`, `info`, `routes`, `endpoints` — use `api-portal --help` for details.
- All commands support `--json` for machine-readable output.
- Auth can be provided via `--token`, `ZAPI_TOKEN`, or `ztoken`.
