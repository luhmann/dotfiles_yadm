#!/usr/bin/env zsh
# ==============================================================================
# ZSH Functions Library - XDG-Compliant Initialization Script
# ==============================================================================
#
# This script initializes the ZSH functions library, providing:
# - Organized function management with categories
# - Fuzzy search and discovery via fzf
# - Easy function browsing by description and keywords
#
# Location: ~/.config/zsh/conf.d/functions.zsh
# Source from ~/.zshrc: source ~/.config/zsh/conf.d/functions.zsh
#

# Set the base directory for ZSH functions (XDG-compliant)
export ZSH_FUNCTIONS_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"

# Add function directories to fpath for reference
fpath=(
  "$ZSH_FUNCTIONS_DIR/zfunctions"
  "$ZSH_FUNCTIONS_DIR/functions"/*(/N)
  $fpath
)

# Load core management functions by creating wrapper functions
zf-browse() { zsh "$ZSH_FUNCTIONS_DIR/zfunctions/zf-browse" "$@" }
zf-add() { zsh "$ZSH_FUNCTIONS_DIR/zfunctions/zf-add" "$@" }
zf-list() { zsh "$ZSH_FUNCTIONS_DIR/zfunctions/zf-list" "$@" }
zf-help() { zsh "$ZSH_FUNCTIONS_DIR/zfunctions/zf-help" "$@" }
zf-search() { zsh "$ZSH_FUNCTIONS_DIR/zfunctions/zf-search" "$@" }

# Autoload all user functions from category directories
local func_file
for func_file in $ZSH_FUNCTIONS_DIR/functions/**/*(.N); do
  autoload -Uz ${func_file:t}
done

# Export categories for use by core functions
export ZSH_FUNCTIONS_CATEGORIES=(git text file docker dev system network)

# Create convenient aliases
alias zfb='zf-browse'
alias zfa='zf-add'
alias zfl='zf-list'
alias zfh='zf-help'
alias zfs='zf-search'

# Print initialization message (optional, controlled by environment variable)
if [[ -n "$ZSH_FUNCTIONS_VERBOSE" ]]; then
  echo "✓ ZSH Functions Library loaded from: $ZSH_FUNCTIONS_DIR"
  echo "  Run 'zf-help' or 'zfh' for usage information"
fi
