# dotfiles

Managed with [yadm](https://yadm.io). Config files live in-place in `~` — no symlinks.

## New Machine Setup

```bash
# 1. Install yadm
curl -fLo /usr/local/bin/yadm https://github.com/yadm-dev/yadm/raw/master/yadm
chmod a+x /usr/local/bin/yadm

# 2. Clone
yadm clone git@github.com:luhmann/dotfiles_yadm.git

# 3. Bootstrap (interactive menu)
yadm bootstrap

# 4. Add secrets to Keychain (see below)
```

### Bootstrap Sections

The bootstrap script is interactive — pick individual sections or run all at once with `yadm bootstrap --all`.

| # | Section | Description |
|---|---------|-------------|
| 1 | SSH key setup | Generates ed25519 key, copies pubkey to clipboard |
| 2 | Xcode CLI tools | Installs compiler toolchain via `softwareupdate` |
| 3 | Create ~/dev | Creates the development directory |
| 4 | Install Homebrew | Installs Homebrew (handles Apple Silicon path) |
| 5 | Brew bundle | Installs all packages/casks from `~/Brewfile` + fzf |
| 6 | Spotlight shortcut | Disables Cmd-Space for Spotlight (frees it for Raycast) |
| 7 | macOS defaults | Applies system preferences (Finder, Dock, keyboard...) |

All sections are idempotent — safe to re-run.

### Recommended Order

```
SSH key -> Xcode CLI -> Homebrew -> brew bundle -> macOS defaults -> secrets
```

SSH key is needed first because `yadm clone` uses SSH. If cloning over HTTPS, SSH can wait.

## What's Tracked

Run `yadm list` for the full list. Key categories:

| Category | Files |
|----------|-------|
| Shell | `.zshrc`, `.zprofile`, `.zshenv`, `.zinitrc` |
| Git | `.gitconfig`, `.gitignore` |
| Editor | `.vim/`, `.config/nvim/` |
| Terminal | `.config/ghostty/config`, `.config/starship.toml` |
| Tools | `.config/atuin/`, `.config/mise/`, `.config/gh/` |
| Search | `.config/television/`, `.ignore`, `.fxrc` |
| Packages | `Brewfile` |
| Bootstrap | `.config/yadm/bootstrap`, `.config/yadm/macos-defaults.bash` |
| Aliases/funcs | `.aliases`, `.config/zsh/functions/` |

### Not Tracked (by design)

| File | Reason |
|------|--------|
| `~/.mise.toml` | Machine-specific, contains Keychain template lookups |
| `~/.config/gh/hosts.yml` | Contains GitHub auth tokens |
| `~/.ssh/` | Private keys |

## Secrets Management (mise + macOS Keychain)

API keys are **not** stored in dotfiles. Instead, `~/.mise.toml` uses [mise's template engine](https://mise.jdx.dev/templates.html) to pull secrets from macOS Keychain at runtime:

```toml
# ~/.mise.toml — no plaintext secrets
[env]
OPENAI_API_KEY = "{{exec(command='security find-generic-password -a ' ~ env.USER ~ ' -s openai-api-key -w')}}"
```

When mise evaluates the config, it calls the `security` CLI, which returns the decrypted value from Keychain. The secret never touches the filesystem.

### Current Secrets

| Environment Variable | Keychain Service Name |
|---|---|
| `OPENAI_API_KEY` | `openai-api-key` |
| `GEMINI_API_KEY` | `gemini-api-key` |
| `OPENROUTER_API_KEY` | `openrouter-api-key` |
| `JIRA_API_TOKEN` | `jira-api-token` |
| `ANTHROPIC_API_KEY` | `anthropic-api-key` |
| `BRAVE_API_KEY` | `brave-api-key` |

### Add a Secret

```bash
# Store in Keychain
security add-generic-password -a "$USER" -s "my-service-api-key" -w "the-secret" -U

# Reference in ~/.mise.toml
# MY_API_KEY = "{{exec(command='security find-generic-password -a ' ~ env.USER ~ ' -s my-service-api-key -w')}}"

# Verify
mise env | grep MY_API
```

### Update / View / Delete

```bash
# View
security find-generic-password -a "$USER" -s "openai-api-key" -w

# Update
security add-generic-password -a "$USER" -s "openai-api-key" -w "new-value" -U

# Delete
security delete-generic-password -a "$USER" -s "openai-api-key"
```

### Restore on New Machine

Keychain items don't transfer automatically. Re-add each secret:

```bash
security add-generic-password -a "$USER" -s "openai-api-key" -w "sk-..." -U
security add-generic-password -a "$USER" -s "gemini-api-key" -w "AIza..." -U
security add-generic-password -a "$USER" -s "openrouter-api-key" -w "sk-or-..." -U
security add-generic-password -a "$USER" -s "jira-api-token" -w "ATATT..." -U
security add-generic-password -a "$USER" -s "anthropic-api-key" -w "sk-ant-..." -U
security add-generic-password -a "$USER" -s "brave-api-key" -w "BSAH..." -U
```

### Why Keychain?

| Approach | Pros | Cons |
|---|---|---|
| Plaintext in file | Simple | Secrets readable by any process |
| **macOS Keychain** | **Encrypted, no extra tools** | **macOS only, manual restore** |
| 1Password CLI (op) | Cross-platform, team sharing | Requires subscription |
| sops + age | Cross-platform, git-friendly | Extra tooling, key management |

## Common yadm Commands

```bash
yadm status                    # see what changed
yadm diff                      # diff working tree
yadm add -u                    # stage all modified tracked files
yadm add ~/.config/foo/bar     # track a new file
yadm commit -m "description"   # commit
yadm push                      # push to GitHub
yadm list                      # list all tracked files
yadm bootstrap                 # re-run bootstrap
```
