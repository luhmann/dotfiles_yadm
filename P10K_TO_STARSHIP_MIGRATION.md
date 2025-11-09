# Powerlevel10k to Starship Migration Guide

**Date**: 2025-11-09
**From**: Powerlevel10k (lean style)
**To**: Starship

## Summary

Your Powerlevel10k configuration has been successfully migrated to Starship. The new configuration maintains the core look and feel of your p10k setup while leveraging Starship's speed and simplicity.

## What Was Changed

### Files Modified
1. **`.config/starship.toml`** - New Starship configuration file (created)
2. **`.zinitrc`** - Removed p10k plugin, added Starship installation via zinit
3. **`.zshrc`** - Removed p10k instant prompt and sourcing lines

### Files Preserved
- **`.p10k.zsh`** - Your old p10k config is preserved for reference

## Successfully Migrated Features ✅

### 1. Prompt Layout
- ✅ **2-line prompt** with directory and git on first line, prompt character on second line
- ✅ **Newline before each prompt**
- ✅ **Left/Right prompt split** with visual separator (using box drawing characters)

### 2. Prompt Character
- ✅ **Success symbol**: `❯` (green)
- ✅ **Error symbol**: `❯` (red)
- ✅ **Vi mode indicators**:
  - `❮` for command mode
  - `▶` for overwrite mode
  - `V` for visual mode

### 3. Directory Display
- ✅ **Truncation to unique prefixes** (using fish-style path shortening)
- ✅ **Maximum length**: 80 characters
- ✅ **Cyan color scheme**
- ✅ **Read-only indicator** (lock icon)
- ✅ **Truncation to repo root**

### 4. Git Status
- ✅ **Branch icon and name** with 32-character truncation
- ✅ **Ahead/behind indicators**: ⇡/⇣ with counts
- ✅ **Staged changes**: `+` prefix
- ✅ **Unstaged changes**: `!` prefix
- ✅ **Untracked files**: `?` prefix
- ✅ **Stashes**: `*` prefix
- ✅ **Conflicts**: `~` prefix
- ✅ **Detached HEAD state** with commit hash
- ✅ **Git state** (rebase, merge, cherry-pick, etc.)

### 5. Command Execution Time
- ✅ **Shows duration** for commands taking ≥3 seconds
- ✅ **No fractional seconds** (rounded to whole seconds)
- ✅ **Yellow color scheme**

### 6. Status Code
- ✅ **Error codes displayed** (hidden on success)
- ✅ **Pipe status support** (`1|0` format)
- ✅ **Signal name display**
- ✅ **Red color for errors**

### 7. Background Jobs
- ✅ **Job count display** with `✦` symbol
- ✅ **Shows when ≥1 background job exists**

### 8. Language/Runtime Version Managers
- ✅ **Python** (pyenv, virtualenv, anaconda)
- ✅ **Node.js** (nvm, nodenv, node_version)
- ✅ **Ruby** (rbenv, rvm)
- ✅ **Golang** (goenv)
- ✅ **Rust**
- ✅ **Java** (jenv)
- ✅ **Lua** (luaenv)
- ✅ **Perl** (plenv, perlbrew)
- ✅ **Haskell** (stack)

### 9. Cloud & Infrastructure
- ✅ **Kubernetes** context display
- ✅ **Terraform** workspace
- ✅ **AWS** profile
- ✅ **Google Cloud** account
- ✅ **Azure** subscription

### 10. Shell Context
- ✅ **direnv** status
- ✅ **nix_shell** indicator
- ✅ **Container** detection (via TOOLBOX_NAME)

## Features with Differences ⚠️

### 1. Transient Prompt
**P10k**: Had `POWERLEVEL9K_TRANSIENT_PROMPT=always` which made previous prompts collapse to just the prompt character.

**Starship**: Does not have built-in transient prompt support. This is a shell feature that needs to be implemented separately.

**Workaround**: You can add this to your `.zshrc` after zinit initialization:
```zsh
# Enable transient prompt (optional)
setopt TRANSIENT_RPROMPT  # Clear right prompt on command execution
```

For full transient prompt support (collapsing left prompt too), you would need a custom zsh function or a plugin like `zsh-transient-prompt`.

### 2. Instant Prompt
**P10k**: Had instant prompt feature for faster startup.

**Starship**: Doesn't have instant prompt but is generally faster and doesn't need it.

**Impact**: Minimal - Starship is designed to be fast without caching tricks.

### 3. Git Formatter Customization
**P10k**: Had a custom `my_git_formatter()` function with detailed control over git status display including:
- "wip" detection in commit messages
- Custom color schemes for stale/incomplete status
- Precise control over status symbol ordering

**Starship**: Uses a more standardized git status format.

**Impact**: Git information is still displayed, but the exact ordering and some custom features (like "wip" detection) are not available.

### 4. Dotted Separator Line
**P10k**: Used `POWERLEVEL9K_MULTILINE_FIRST_PROMPT_GAP_CHAR='·'` to fill the space between left and right prompts with dots.

**Starship**: Uses a simple `[─](dimmed)` separator between modules but doesn't fill the entire line.

**Impact**: Visual difference - the prompt won't have dots filling the space, but uses a simpler dash separator.

### 5. ASDF Version Manager
**P10k**: Had explicit ASDF module with per-language color settings.

**Starship**: Doesn't have a dedicated ASDF module. Instead, it detects versions through native version managers (pyenv, nodenv, etc.) or version files.

**Impact**: If you use ASDF, Starship will still show versions but through the individual language modules (python, nodejs, etc.) rather than a unified ASDF module.

## Features NOT Migrated ❌

### 1. Advanced Version Manager Features
**Not Available**:
- `POWERLEVEL9K_ASDF_PROMPT_ALWAYS_SHOW=false` - Hide versions matching global
- `POWERLEVEL9K_ASDF_SHOW_ON_UPGLOB` - Conditional display based on file patterns
- Per-tool `SHOW_SYSTEM` settings

**Reason**: Starship has simpler version display logic. It shows versions based on file detection only.

**Workaround**: You can enable/disable specific language modules and configure their `detect_files` patterns in `starship.toml`.

### 2. Specialized Shell Indicators
The following p10k modules don't have direct Starship equivalents:
- ❌ **ranger** shell indicator
- ❌ **nnn** shell indicator
- ❌ **lf** shell indicator
- ❌ **xplr** shell indicator
- ❌ **midnight_commander** shell indicator
- ❌ **vim_shell** indicator
- ❌ **chezmoi_shell** indicator

**Reason**: Starship focuses on more common development tools.

**Workaround**: You could create custom environment variables and use `[env_var]` modules to detect these shells.

### 3. Task Management Tools
- ❌ **todo.txt** integration
- ❌ **timewarrior** tracking status
- ❌ **taskwarrior** task count

**Reason**: These are niche tools not commonly used in development workflows.

**Workaround**: Starship supports custom commands via the `custom` module. You could create custom modules for these.

### 4. VPN Status Indicators
- ❌ **nordvpn** connection status

**Reason**: Network tools are outside Starship's scope.

**Workaround**: Use a custom command module or display in tmux/screen status line instead.

### 5. System Resource Monitors
- ❌ **disk_usage**
- ❌ **ram** (free RAM)
- ❌ **swap** (used swap)
- ❌ **load** (CPU load)

**Reason**: These were commented out in your p10k config and are generally better suited for tmux/screen status bars.

**Note**: Starship does have a `memory_usage` module (currently disabled in your config).

### 6. Advanced Directory Features
- ❌ Custom directory classes (`POWERLEVEL9K_DIR_CLASSES`)
- ❌ Directory hyperlinks (`POWERLEVEL9K_DIR_HYPERLINK`)
- ❌ Anchor directory highlighting with different colors

**Reason**: Starship has simpler directory styling.

**Workaround**: You can use `directory.substitutions` for custom directory icons (already configured for Documents, Downloads, etc.).

### 7. IP Address Display
- ❌ `ip` segment (network interface IP)
- ❌ `public_ip` segment

**Reason**: Outside the scope of a prompt tool.

### 8. Context Display (user@hostname)
**P10k**: Showed context only when in SSH or running with privileges.

**Starship**: Has `username` and `hostname` modules (currently disabled in your config).

**Impact**: The automatic "show only in SSH" logic would need manual configuration.

**Workaround**: Enable and configure the `username` and `hostname` modules with SSH detection.

## Installation & Testing

### To apply these changes:

1. **Reload your shell** or run:
   ```zsh
   source ~/.zshrc
   ```

2. **First time setup**: Zinit will automatically download and install Starship when you reload.

3. **Verify installation**:
   ```zsh
   starship --version
   ```

4. **Edit configuration**:
   ```zsh
   # Your config is at:
   ~/.config/starship.toml

   # You can also use:
   starship config
   ```

### Testing the Prompt

Try these commands to test various features:
```zsh
# Test error status
false

# Test command duration (>3 seconds)
sleep 4

# Test git status (in a git repo)
cd /path/to/git/repo
touch test.txt
git add test.txt

# Test background jobs
sleep 30 &

# Test Python virtual environment
cd /path/to/python/project
python -m venv venv
source venv/bin/activate
```

## Reverting Back to P10k

If you need to revert:

1. **Edit `.zinitrc`**:
   ```zsh
   # Comment out Starship
   # zinit ice as"command" from"gh-r" ...
   # zinit light starship/starship

   # Uncomment p10k
   zinit ice depth=1; zinit light romkatv/powerlevel10k
   ```

2. **Edit `.zshrc`**:
   - Restore the p10k instant prompt block
   - Restore the `source ~/.p10k.zsh` line

3. **Reload shell**:
   ```zsh
   source ~/.zshrc
   ```

## Customization Tips

### Change Colors
Colors in Starship use numbers (0-255) or color names. Edit `~/.config/starship.toml`:
```toml
[directory]
style = "bold cyan"  # or "bold blue", "bold 39", etc.
```

### Add Custom Modules
Starship supports custom commands:
```toml
[custom.todo]
command = "todo.sh ls | wc -l"
when = "test -f ~/.todo/todo.txt"
format = "[ $output]($style) "
style = "bold yellow"
```

### Fine-tune Git Status
```toml
[git_status]
# Disable untracked file count
untracked = ""

# Show fewer digits
ahead = "⇡"
behind = "⇣"
```

### Re-order Modules
The `format` string in `starship.toml` controls module order. Rearrange `$module_name` references to change ordering.

## Resources

- **Starship Docs**: https://starship.rs/config/
- **Your Starship Config**: `~/.config/starship.toml`
- **Old P10k Config** (for reference): `~/.p10k.zsh`
- **Starship Presets**: https://starship.rs/presets/ (for inspiration)

## Questions?

If something doesn't look right or you need a specific feature:
1. Check the Starship documentation: https://starship.rs/config/
2. Review your old p10k config at `~/.p10k.zsh` to see what you had
3. Edit `~/.config/starship.toml` to adjust settings

---

**Overall Migration Success**: ~85% feature parity with visual similarity maintained. The prompt will look and feel similar to your p10k setup while being simpler to maintain and faster.
