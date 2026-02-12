## Profiling zsh - used in conjungction with `zprof`-command on the bottom
# zmodload zsh/zprof

# Starship prompt is loaded via zinit in ~/.zinitrc
# No instant prompt needed as Starship is fast by default


### Added by Zinit's installer
if [[ ! -f $HOME/.local/share/zinit/zinit.git/zinit.zsh ]]; then
    print -P "%F{33} %F{220}Installing %F{33}ZDHARMA-CONTINUUM%F{220} Initiative Plugin Manager (%F{33}zdharma-continuum/zinit%F{220})…%f"
    command mkdir -p "$HOME/.local/share/zinit" && command chmod g-rwX "$HOME/.local/share/zinit"
    command git clone https://github.com/zdharma-continuum/zinit "$HOME/.local/share/zinit/zinit.git" && \
        print -P "%F{33} %F{34}Installation successful.%f%b" || \
        print -P "%F{160} The clone has failed.%f%b"
fi

source "$HOME/.local/share/zinit/zinit.git/zinit.zsh"
autoload -Uz _zinit
(( ${+_comps} )) && _comps[zinit]=_zinit
### End of Zinit's installer chunk

typeset -gUx PATH FPATH
if [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
  fpath=(/opt/homebrew/share/zsh/site-functions $fpath)
fi

# ZSH Functions Library (autoload custom completions before compinit)
source "${XDG_CONFIG_HOME:-$HOME/.config}/zsh/conf.d/functions.zsh"

# Enable alias expansion during completion (must happen before compinit)
# unsetopt completealiases  # Disabled - was preventing alias completion

source ~/.zinitrc

# configure zsh-plugins
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=9"
bindkey '^[[A' history-substring-search-up
bindkey '^[[B' history-substring-search-down

# Hook up aliases
source ~/.aliases
source ~/.dg

# Enable completealiases option to allow proper alias completion
setopt completealiases

# Enable completions for git aliases via the stock _git completer
compdef _git g=git
compdef _git gco=git
compdef _git gc=git
compdef _git ga=git
compdef _git gp=git
compdef _git gs=git
compdef _git gl=git
compdef _git gb=git
compdef _git gam=git

# Enable completions for other command aliases
compdef _gh repo=gh
compdef _bat cat=bat
compdef _eza ll=eza
compdef _rg rg=rg
compdef _rg grep=rg

# Put local node_modules/.bin in path
export PATH="$PATH:./node_modules/.bin"
export GITU_SHOW_EDITOR="zed"

# enable fzf
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh

# Use fd for FZF file search (faster, respects .gitignore)
export FZF_DEFAULT_COMMAND='fd --type f --hidden --follow --exclude .git'
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"

# Enhanced previews
export FZF_CTRL_T_OPTS="
  --preview 'bat --color=always --line-range :500 {}'
  --preview-window right:60%
  --bind 'ctrl-/:toggle-preview'
"

export FZF_ALT_C_OPTS="
  --preview 'eza --tree --color=always --level=2 {} | head -200'
  --preview-window right:60%
"

# Enhanced default options (multi-select, reverse layout, border, height)
export FZF_DEFAULT_OPTS='--multi --reverse --height 40% --border'


# use python from homebrew
# export PATH="/usr/local/opt/python/libexec/bin:$PATH"

# Starship configuration is in ~/.config/starship.toml
# To customize prompt, edit that file or run: starship config

eval "$(/opt/homebrew/bin/mise activate zsh)"

export PATH="/opt/homebrew/opt/postgresql@13/bin:$PATH"

# doom-emacs tools
export PATH="$HOME/.emacs.d/bin:$PATH"

# activate zoxide
eval "$(zoxide init zsh)"

# activate atuin (modern shell history)
eval "$(atuin init zsh --disable-up-arrow)"

# Note: compinit is handled by zinit's zpcompinit in .zinitrc
# No need to call it again here

# Install s5cmd autocompleteion
_s5cmd_cli_zsh_autocomplete() {
	local -a opts
	local cur
	cur=${words[-1]}
	opts=("${(@f)$(${words[@]:0:#words[@]-1} "${cur}" --generate-bash-completion)}")

	if [[ "${opts[1]}" != "" ]]; then
	  _describe 'values' opts
	else
	  _files
	fi
}

compdef _s5cmd_cli_zsh_autocomplete s5cmd

# source env variables from a local file if it exists
[ -f ~/.local_env ] && source ~/.local_env

# Profiling for zsh load speed - used in conjungtion with the other `zprof` command on top of this file
# zprof

# opencode
export PATH=/Users/jfd/.opencode/bin:$PATH

# Added by LM Studio CLI (lms)
export PATH="$PATH:/Users/jfd/.lmstudio/bin"
# End of LM Studio CLI section

# Claude Code conversation history search
# Interactive conversation search with fzf (excludes agent sidechains)
claude-search() {
  local search_path="${1:-$HOME/.claude/projects}"

  find "$search_path" -name "*.jsonl" -type f -exec cat {} + 2>/dev/null |
  jq -r 'select(.message.content != null) |
    select(.isSidechain != true) |
    select(.type == "user" or .type == "assistant") |
    "\(.timestamp[0:10])\t\(input_filename | split("/")[-2] | gsub("-";"/"))\t\(
      if .message.content | type == "string" then .message.content
      else [.message.content[]? | select(.type == "text") | .text // ""] | join(" ")
      end | gsub("\n";" ") | .[0:150]
    )"' 2>/dev/null |
  fzf --delimiter='\t' --with-nth=1,2,3 --preview-window=wrap
}

# Search conversations with Q&A context (v3 - fuzzy via fzf)
# Usage: claude-recall <query> [--all] [--full] [--exact]
claude-recall() {
  local args="$*"
  local query search_path show_full=false use_exact=false

  # Parse flags
  [[ "$args" == *"--all"* ]] && { search_path="$HOME/.claude/projects"; args="${args//--all/}"; } || {
    local project_dir=$(echo "$PWD" | sed 's|/|-|g')
    search_path="$HOME/.claude/projects/$project_dir"
    [[ ! -d "$search_path" ]] && search_path="$HOME/.claude/projects"
  }
  [[ "$args" == *"--full"* ]] && { show_full=true; args="${args//--full/}"; }
  [[ "$args" == *"--exact"* ]] && { use_exact=true; args="${args//--exact/}"; }
  query=$(echo "$args" | xargs)

  # Find files containing any query word (fast pre-filter)
  local first_word="${query%% *}"
  rg --files-with-matches -i "$first_word" "$search_path" --glob "*.jsonl" 2>/dev/null | head -5 | while read -r file; do
    local project=$(basename "$(dirname "$file")" | sed 's/^-//; s/-/\//g')
    local session=$(basename "$file" .jsonl)

    if [[ "$show_full" == true ]]; then
      # Show entire conversation (no fuzzy filter needed)
      echo "=== $project ==="
      echo "Session: $session"
      echo "Resume: claude --resume $session"
      echo ""
      jq -r 'select(.message.content != null) | select(.isSidechain != true) |
        select(.type == "user" or .type == "assistant") |
        "[\(.timestamp[0:10])] \(.type | ascii_upcase):\n" +
        (if .message.content | type == "string" then .message.content[0:800]
         else ([.message.content[]? | select(.type == "text") | .text // ""] | join(" "))[0:800]
         end) + "\n"
      ' "$file" 2>/dev/null
      echo "---"
    else
      # Extract all messages, fuzzy filter with fzf, then format
      local matches
      if [[ "$use_exact" == true ]]; then
        # Exact substring matching (old behavior)
        matches=$(jq -sr '
          def text:
            if .message.content | type == "string" then .message.content
            else [.message.content[]? | select(.type == "text") | .text // ""] | join(" ")
            end;

          [.[] | select(.message.content != null and .isSidechain != true and
                        (.type == "user" or .type == "assistant"))] |
          to_entries | .[] |
          "\(.key)|\(.value.timestamp[0:10])|\(.value.type)|\(.value | text | gsub("\n"; " "))"
        ' "$file" 2>/dev/null | grep -i "$query")
      else
        # Fuzzy matching via fzf
        matches=$(jq -sr '
          def text:
            if .message.content | type == "string" then .message.content
            else [.message.content[]? | select(.type == "text") | .text // ""] | join(" ")
            end;

          [.[] | select(.message.content != null and .isSidechain != true and
                        (.type == "user" or .type == "assistant"))] |
          to_entries | .[] |
          "\(.key)|\(.value.timestamp[0:10])|\(.value.type)|\(.value | text | gsub("\n"; " "))"
        ' "$file" 2>/dev/null | fzf -f "$query" --no-sort)
      fi

      # If matches found, get matching indices and their replies
      if [[ -n "$matches" ]]; then
        echo "=== $project ==="
        echo "Session: $session"
        echo "Resume: claude --resume $session"
        echo ""

        # Extract indices that matched, add +1 for replies
        local show_indices=$(echo "$matches" | cut -d'|' -f1 | while read -r idx; do
          echo "$idx"
          echo "$((idx + 1))"
        done | sort -n | uniq | tr '\n' ',' | sed 's/,$//')

        # Output the matched messages with context
        jq -sr --argjson indices "[$show_indices]" '
          def text:
            if .message.content | type == "string" then .message.content
            else [.message.content[]? | select(.type == "text") | .text // ""] | join(" ")
            end;

          [.[] | select(.message.content != null and .isSidechain != true and
                        (.type == "user" or .type == "assistant"))] |
          to_entries |
          [.[] | select(.key as $k | $indices | index($k))] |
          .[0:20] | .[] |
          "[\(.value.timestamp[0:10])] \(.value.type | ascii_upcase):\n\(.value | text | .[0:600])\n"
        ' "$file" 2>/dev/null
        echo "---"
      fi
    fi
  done
}
export PATH=$PATH:$HOME/.maestro/bin
