# ai-usage

A dependency-free, single-file Python renderer for CodexBar subscription usage.

The entire tool is one self-contained script tracked in yadm as `.local/bin/ai-usage` (stdlib only, `#!/usr/bin/env python3`), invoked as `ai-usage` or via the `aiu` alias. There is no separate implementation file and no hardcoded machine path: `yadm clone` on any machine installs a working command. This directory (`~/.local/share/ai-usage`, also tracked in yadm) holds only the tests and these notes.

```sh
ai-usage                  # All reported quotas, used bars, resets, pace and balances
ai-usage --details        # Exact reset times and reported daily credit history
ai-usage --json           # Original JSON, including account identity: treat as private
ai-usage --provider claude
ai-usage --no-color
```

Requires Python 3 and CodexBar (`brew install codexbar`, or any `codexbar` on `PATH`; `/opt/homebrew/bin/codexbar` is used as a fallback). Defaults to `--source web`; authentication and browser-cookie import remain CodexBar's responsibility. No credentials or usage snapshots are stored by this tool.

Pace is CodexBar's estimate comparing usage with elapsed time in a quota window. The compact display prefers the weekly estimate, falling back to primary. Staying within pace is not a guarantee: future work can consume quota faster. The percentage shown as a baseline is the expected usage at this point in the window, not quota used.

Additional model windows are discovered dynamically. Equal primary/secondary weekly quotas whose resets differ by at most 60 seconds are collapsed, with a visible note. This is a presentation heuristic, not proof that the backend limits are identical; use `--json` to inspect the original records. Window duration determines labels; primary is not automatically treated as a five-hour session. Missing values stay unknown. Credit units are never converted to currency. Missing history dates are not filled with zeros.

Rendering hides account identity. `--details` shows source-provided detail rows and daily credit history, not every raw JSON field. `--json` preserves raw output. Errors from CodexBar are forwarded to stderr and its exit status is retained, including partial failures. ANSI colours are used only in a terminal and respect `NO_COLOR`.

Tests:

```sh
cd ~/.local/share/ai-usage
python3 -m unittest -v                     # tests ~/.local/bin/ai-usage
AI_USAGE_BIN=/path/to/ai-usage python3 -m unittest -v
```

The tests load the installed script by path, so they always exercise the file that yadm ships — edit `~/.local/bin/ai-usage` directly, then run the tests.
