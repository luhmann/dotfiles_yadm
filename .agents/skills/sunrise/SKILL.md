---
name: sunrise
description: >
  Look up Zalando organizational and infrastructure data (people, teams,
  applications, APIs, TOER orgs, tooling, AWS accounts, incident playbooks,
  CDP pipeline runs/failures, deployments, and zdocs technical docs) via the
  local `sunrise-cli`. Use when the user asks who owns an app, who manages
  someone, which team owns an API, why a CDP pipeline failed, what deployed
  recently, or to search Zalando tech documentation.
---

# Sunrise CLI

A global `sunrise-cli` is on PATH (`~/.local/bin/sunrise-cli`). It is a thin
client over the deployed Zalando sunrise-mcp server (Streamable HTTP).
Authentication is automatic via `ztoken` — no setup needed.

## Two commands

```bash
sunrise-cli list                        # list all available tools (~25)
sunrise-cli call <tool> key=value ...   # call one tool
```

Both honour `--url` (before the subcommand) or `SUNRISE_MCP_URL`; the default
is the production endpoint `https://sunrise-mcp.stups.zalan.do/mcp`.

## Arguments

Each `key=value` value is parsed as JSON, falling back to a plain string when
it is not valid JSON:

- Strings: `user=fldietrich` or `query="is:unread"`
- Numbers/bools: `limit=5`, `is_cw_relevant=true`
- Lists/objects need JSON: `branches='["main"]'`, `users='["a","b"]'`

Quote values containing shell-special characters or spaces.

## Authentication

The CLI calls `ztoken token` per invocation (fast, self-caching/refreshing).
Set `SUNRISE_TOKEN` to override with an explicit bearer token. The remote
endpoint accepts a stock user token — no special scopes required.

## Scope: read-only

All tools are read-only lookups (get/list/search). Run `sunrise-cli list` to
see the current surface; descriptions are the first line of each docstring.

## Common workflows

People & org:

```bash
sunrise-cli call get_user user=<login>            # delivery_lead = manager
sunrise-cli call get_user_by_email email=<addr>
sunrise-cli call get_sunrise_team team_id=<sap-id-or-alias>
```

Search (indexes: person, teams, api, application, zdocs):

```bash
sunrise-cli call search query="nakadi" index=zdocs limit=5
sunrise-cli call search query="pitchfork" index=teams
```

Applications & APIs:

```bash
sunrise-cli call get_applications owner=<team> is_cw_relevant=true
sunrise-cli call get_application application_id=<id>
sunrise-cli call get_apis owner=<team>
```

CI/CD pipeline debugging:

```bash
sunrise-cli call get_cdp_runs github_repo_url=https://github.com/org/repo limit=3
sunrise-cli call get_cdp_run_step_failures run_id=<id>   # id from get_cdp_runs
sunrise-cli call get_recent_deployments github_repo_url=https://github.com/org/repo
```

Documentation (search zdocs, then fetch the page):

```bash
sunrise-cli call search query="kubernetes cluster setup" index=zdocs
sunrise-cli call get_documentation_page domain=<domain> filepath=<path>
sunrise-cli call get_documentation_page_by_url url=https://<domain>.docs.zalando.net/<path>
```

Incident playbooks & infrastructure:

```bash
sunrise-cli call get_playbooks application=<app>
sunrise-cli call get_infrastructure_accounts cost_center_filter='["0001105300"]'
```

## When unsure

Run `sunrise-cli list` to discover exact tool names, then infer argument names
from the descriptions or make a minimal call — the server returns descriptive
errors for missing/invalid parameters.
