# dotfiles

Managed with [yadm](https://yadm.io). Config files live in-place in `~` — no symlinks.

## New Machine Setup

Single command to set up a fresh Mac:

```bash
curl -fsSL https://raw.githubusercontent.com/luhmann/dotfiles_yadm/main/.config/yadm/kickstart.sh | bash
```

This installs Xcode CLI tools, Homebrew, yadm, clones the dotfiles, and launches the interactive bootstrap menu.

### Flags

```bash
# Dev tools only (default)
curl -fsSL ... | bash

# Include personal apps
curl -fsSL ... | bash -s -- --personal

# Run all steps unattended (dev only)
curl -fsSL ... | bash -s -- --all

# Run all steps including personal apps
curl -fsSL ... | bash -s -- --all --personal
```

### Bootstrap Sections

The bootstrap script is interactive — pick individual sections or run all at once with `yadm bootstrap --all`.

| # | Section | Description |
|---|---------|-------------|
| 1 | SSH key setup | Generates ed25519 key(s), prompts for additional keys |
| 2 | Xcode CLI tools | Installs compiler toolchain via `softwareupdate` |
| 3 | Create ~/dev | Creates the development directory |
| 4 | Install Homebrew | Installs Homebrew (handles Apple Silicon path) |
| 5 | Brew bundle | Installs packages from `Brewfile.dev` (+ `Brewfile.personal` with `--personal`) |
| 6 | GitHub SSH keys | Upload SSH keys to GitHub via `gh` CLI (select which keys) |
| 7 | Claude Code | Installs via `curl` for auto-updates |
| 8 | MonoLisa font | Retrieves font from 1Password vault |
| 9 | Spotlight shortcut | Disables Cmd-Space for Spotlight (frees it for Raycast) |
| 10 | macOS defaults | Applies system preferences (Finder, Dock, keyboard...) |

All sections are idempotent — safe to re-run.

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
| Packages | `Brewfile.dev`, `Brewfile.personal` |
| Bootstrap | `.config/yadm/bootstrap`, `.config/yadm/kickstart.sh`, `.config/yadm/macos-defaults.bash` |
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

## AI Agent Sessions via tmux

Run AI coding agents in persistent tmux sessions so you can detach and reattach from anywhere (e.g. SSH from your phone).

### Aliases

| Alias | Description |
|-------|-------------|
| `ac`  | Start a new Claude Code session (`claude` in tmux) |
| `ap`  | Start a new Pi agent session (`pi` in tmux) |
| `cac` | Continue/attach to a running Claude Code session |
| `cap` | Continue/attach to a running Pi agent session |

### Workflow

**Start a session on your Mac:**

```sh
ac   # starts claude in a tmux session called "agent-claude"
```

Work as usual. When you need to leave, detach with `Ctrl-a d`.

**Continue from your phone via SSH:**

```sh
ssh your-mac
cac  # reattaches to the running claude session
```

Detach again with `Ctrl-a d` when done.

### Useful tmux commands

| Keys | Action |
|------|--------|
| `Ctrl-a d` | Detach from session (leaves it running) |
| `Ctrl-a [` | Enter scroll/copy mode (navigate with arrows, `q` to exit) |
| `tmux ls`  | List all running sessions |
| `tmux kill-session -t agent-claude` | Kill a specific session |
