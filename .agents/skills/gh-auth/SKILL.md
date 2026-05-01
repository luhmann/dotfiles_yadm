---
name: gh-auth
description: >
  Fix GitHub CLI (gh) authentication failures in sandboxed or
  non-interactive environments (e.g. pi, agent harnesses). Use when
  gh commands fail with "HTTP 401: Requires authentication" or
  "The token in default is invalid".
---

# gh CLI Auth Troubleshooting

## Problem

`gh` commands intermittently fail with:
```
HTTP 401: Requires authentication
```
or:
```
The token in default is invalid.
```

This can happen in agent processes (pi, Claude Code, etc.) even
when `gh auth status` works moments later.

## Diagnosis

1. Check if `gh` can read the token at all:

```bash
gh auth token
```

2. Check auth status:

```bash
gh auth status
```

3. If both fail, confirm the token is in the keyring:

```bash
security find-generic-password -s "gh:github.com" -a "<username>" -w
```

The value is prefixed with `go-keyring-base64:` followed by a
base64-encoded token. Decode with:

```bash
echo "<base64-part>" | base64 -d
```

## Fixes

### Transient failure (most common)

The macOS keyring can be temporarily locked or the OAuth token
may be mid-refresh. Simply **retry the command**. This is the
most common cause in agent harnesses.

### Persistent failure — use GH_TOKEN

If `gh auth token` succeeds but API calls fail, or if keyring
reads fail entirely, extract the token and set it as an env var:

```bash
export GH_TOKEN=$(security find-generic-password \
  -s "gh:github.com" \
  -a "$(gh config get -h github.com user 2>/dev/null)" \
  -w 2>/dev/null | sed 's/^go-keyring-base64://' | base64 -d)
```

Then all `gh` commands in that shell session authenticate via
`GH_TOKEN` instead of the keyring.

### Per-command workaround

```bash
GH_TOKEN="<token>" gh pr view 20 --json comments
```

## Root Cause

`gh` stores OAuth tokens in the macOS keyring via `go-keyring`.
The keyring can become temporarily inaccessible due to:
- Login keychain lock timeout
- OAuth token refresh race conditions
- Sandbox entitlement issues (rare — agent-safehouse.dev uses
  `sandbox-exec` but typically allows keychain access)

The `security` CLI (`/usr/bin/security`) is an Apple-signed
binary with broad keychain entitlements and usually succeeds
even when in-process keyring access fails.
