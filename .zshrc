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

source ~/.zinitrc

# configure zsh-plugins
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=9"
bindkey '^[[A' history-substring-search-up
bindkey '^[[B' history-substring-search-down

# Hook up aliases
source ~/.aliases
source ~/.dg

# Put local node_modules/.bin in path
export PATH="$PATH:./node_modules/.bin"
export GITU_SHOW_EDITOR="zed"

# enable fzf
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh
export FZF_DEFAULT_OPTS='--multi --reverse'


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

autoload -Uz compinit
compinit

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
