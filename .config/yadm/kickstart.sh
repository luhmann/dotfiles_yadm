#!/bin/bash
#
# Kickstart a fresh macOS machine with a single command:
#
#   curl -fsSL https://raw.githubusercontent.com/luhmann/dotfiles_yadm/main/.config/yadm/kickstart.sh | bash
#
# Flags are passed through to yadm bootstrap:
#
#   curl -fsSL ... | bash -s -- --all --personal
#

set -euo pipefail

GREEN=$(tput setaf 2 2>/dev/null || true)
BOLD=$(tput bold 2>/dev/null || true)
RESET=$(tput sgr0 2>/dev/null || true)

step() {
    echo ""
    echo "${GREEN}${BOLD}==> $1${RESET}"
}

# ---------------------------------------------------------------------------
# 1. Xcode Command Line Tools
# ---------------------------------------------------------------------------
if ! xcode-select -p &>/dev/null; then
    step "Installing Xcode Command Line Tools..."
    xcode-select --install
    echo "Press Enter after the installation dialog completes..."
    read -r
fi

# ---------------------------------------------------------------------------
# 2. Homebrew
# ---------------------------------------------------------------------------
if ! command -v brew &>/dev/null; then
    step "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Always ensure brew is in PATH (covers fresh install, partial re-runs,
# and cases where brew is installed but not yet in this shell's PATH).
# No need to follow Homebrew's suggestion to modify .zprofile — yadm
# already manages that file.
if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
fi

# ---------------------------------------------------------------------------
# 3. yadm
# ---------------------------------------------------------------------------
if ! command -v yadm &>/dev/null; then
    step "Installing yadm..."
    brew install yadm
fi

# ---------------------------------------------------------------------------
# 4. Clone dotfiles
# ---------------------------------------------------------------------------
if [[ ! -d "$HOME/.local/share/yadm/repo.git" ]]; then
    step "Cloning dotfiles..."
    yadm clone https://github.com/luhmann/dotfiles_yadm.git --no-bootstrap
fi

# ---------------------------------------------------------------------------
# 5. Run bootstrap
# ---------------------------------------------------------------------------
step "Running yadm bootstrap..."
yadm bootstrap "$@"
