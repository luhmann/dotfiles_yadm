---
name: zolaris-testing
description: "Automated QA testing for the Zolaris purchase-orders-frontend using Rodney and showboat. Use when the user asks to run Zolaris UI tests, create or execute test protocols, capture screenshots, authenticate to staging, or validate purchase order flows in the Zolaris frontend."
---

# Zolaris Testing

Automated QA testing of the Zolaris frontend (purchase-orders-frontend) using `rodney` (headless Chrome automation) and `showboat` (executable test documents with screenshots).

## Prerequisites

- `uvx rodney` — Chrome automation via DevTools Protocol
- `uvx showboat` — Executable markdown documents with captured output
- `ztoken` — Zalando Platform IAM token CLI
- Safehouse sandbox: use `--enable=chromium-headless` (provides Crashpad Mach ports, GPU, etc.)
- File-path rules for `~/.cache/rod` and `~/.rodney` in `~/.config/agent-safehouse/local-overrides.sb`

**Important:** When testing sandbox compatibility, prefix commands with the full safehouse invocation:
```bash
safehouse --enable=docker,shell-init,1password,ssh,chromium-headless \
  --env-pass=JIRA_API_TOKEN,BRAVE_API_KEY,EXA_API_KEY,SSL_CERT_FILE \
  --append-profile=~/.config/agent-safehouse/local-overrides.sb \
  uvx rodney <command>
```
Do NOT test with bare `uvx rodney` — that runs outside the sandbox and masks permission issues.

## Auth Flow (No Manual SSO Required)

The app uses `WSHeader.setStorageType('cookie', 'retail-ops')` which stores access tokens as URL-encoded JSON strings in cookies.

### Steps

```bash
# 1. Start headless Chrome
uvx rodney start

# 2. Navigate to staging
uvx rodney open "https://zolaris-release.retail-operations-test.zalan.do"

# 3. Get a fresh token
TOKEN=$(ztoken token -n zolaris-qa 2>&1)

# 4. Inject the token cookie (note: underscore in access_token, %22-wrapped value)
uvx rodney js "document.cookie = 'retail-ops-access_token=%22${TOKEN}%22; path=/'"

# 5. Navigate — now authenticated
uvx rodney open "https://zolaris-release.retail-operations-test.zalan.do/"
# Should land on /#/list instead of /#/login
```

### Cookie Format Details

- Key: `retail-ops-access_token` (underscore, not hyphen)
- Value: `%22<JWT>%22` — the JWT wrapped in URL-encoded double quotes (`%22` = `"`)
- This matches WSHeader's CookieStorage which does `encodeURIComponent(JSON.stringify(token))`

## Showboat Document Setup

```bash
# Create test protocol document
uvx showboat init ~/icloud/org/_test_protocols/<date>-<ticket>-<name>.md "Title"

# Add commentary
uvx showboat note <file> "Some note"

# Run command and capture output
uvx showboat exec <file> bash "uvx rodney url"

# Add screenshot (must use absolute path)
uvx rodney screenshot /absolute/path/to/screenshot.png
uvx showboat image <file> "![Description](/absolute/path/to/screenshot.png)"
```

## UI Interaction Patterns

The Zolaris frontend uses Aurelia with `@fabric-design/components-legacy` (WSHeader, ws-multi-select, ws-option-buttons, etc.).

### Clicking elements

`rodney click` uses CSS selectors. For text-based clicks, use JS:

```bash
# Click by text content
uvx rodney js "(() => { const els = document.querySelectorAll('button'); for(const b of els) { if(b.textContent.trim() === 'Apply') { b.click(); return 'clicked'; }} return 'not found'; })()"

# Click dropdown items (ws-multi-select)
uvx rodney js "document.querySelector('#filter-sub-units .dropdown-item:first-child a').click()"

# Click option buttons (ws-option-buttons)
uvx rodney js "document.querySelector('#filter-seasons .option-button:first-child a').click()"
```

### Expanding filter groups

```bash
uvx rodney js "(() => { const groups = document.querySelectorAll('filter-group .headline .text'); for(const g of groups) { if(g.textContent.trim() === 'Seasons') { g.parentElement.click(); return 'clicked'; } } return 'not found'; })()"
```

## Environments

| Environment | Frontend URL | Auth |
|-------------|-------------|------|
| Staging (release) | `https://zolaris-release.retail-operations-test.zalan.do` | `sandbox.identity.zalando.com` |
