#!/usr/bin/env bash
#
# Restore fnox secrets on a machine that already has yadm + mise.
#
# Usage:
#   ~/.config/fnox/setup.sh
#
# Prerequisites:
#   yadm pull && mise install
#
set -euo pipefail

ok()   { echo -e "\033[0;32m[OK]\033[0m $1"; }
skip() { echo -e "\033[0;33m[SKIP]\033[0m $1"; }
fail() { echo -e "\033[0;31m[ERROR]\033[0m $1"; exit 1; }

for cmd in op fnox age-keygen; do
    command -v "$cmd" &>/dev/null || fail "$cmd not found. Run 'mise install' first."
done
op vault list &>/dev/null 2>&1 || fail "1Password CLI not authenticated. Enable Developer CLI integration in 1Password settings."

# 1. Restore age key from 1Password
if [[ -f "$HOME/.config/fnox/age.txt" ]]; then
    skip "age.txt already exists"
else
    op read "op://Automation/fnox-age-key/notesPlain" > "$HOME/.config/fnox/age.txt"
    chmod 600 "$HOME/.config/fnox/age.txt"
    ok "Restored age key from 1Password"
fi

# 2. Sync secrets → local age cache
cd "$HOME"
fnox sync --provider age --config fnox.local.toml --force
ok "Synced secrets to ~/fnox.local.toml"

echo ""
echo "Done. Reload your shell: exec zsh"
