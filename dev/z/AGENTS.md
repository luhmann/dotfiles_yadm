- emit file references as markdown links with file:// URLs, e.g. [packages/ai/src/foo.ts](file:///Users/fldietrich/dev/jf/pi-mono/packages/ai/src/foo.ts).

## Kotlin / Gradle — Final Validation

Before committing changes in any Kotlin/Gradle project, run this sequence **once** at the very end:

```shell
./gradlew ktlintFormat && ./gradlew check
```

This auto-fixes formatting first, then runs the full verification suite (tests + coverage + lint + YAML validation). It is time-intensive (~1 min) so do not run it after every small edit — only as the final gate. Any errors must be fixed before committing.

**Important:** Always use the Gradle plugin (`./gradlew ktlintFormat`) for formatting — never the standalone `ktlint` CLI. The Gradle plugin is the source of truth for lint config (ktlint version, `.editorconfig`, exclusion filters). The standalone CLI may use a different version and miss project-specific settings.

`ktlintFormat` may reformat lines that are valid but not in its preferred style, producing cosmetic noise beyond your actual changes. This is expected — accept those reformats as part of the commit.

## Service Tokens

For Zalando API tests that need service/internal scopes, use the Greyhound
helper checked out at `~/dev/z/frschulze-greyhound`:

```shell
cd ~/dev/z/frschulze-greyhound
TOKEN="$(./greyhound.sh -s | jq -r '.access_token')"
```

The script logs into the `retail-operations` AWS account, downloads the
required service/client credentials from S3, and requests a service-realm token.
Use this instead of regular user tokens when POM internal scopes are required.

## Nakadi CLI

- A global `nakadi-cli` tool is available on PATH for investigating
  Zalando Nakadi events.
- Use `nakadi-cli --help` for command and option details.
- Auth can be provided via `--token`, `NAKADI_TOKEN`, or `ztoken`.

## API Portal CLI

- A global `api-portal` tool is available on PATH for searching and
  inspecting APIs registered in the Zalando API Portal (apis.zalando.net).
- Commands: `search`, `info`, `routes`, `endpoints` — use `api-portal --help` for details.
- All commands support `--json` for machine-readable output.
- Auth can be provided via `--token`, `ZAPI_TOKEN`, or `ztoken`.
