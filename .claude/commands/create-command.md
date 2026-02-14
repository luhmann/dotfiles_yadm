---
description: "Interactive helper to create new slash commands"
---

Help the user create a new Claude Code slash command in ~/.claude/commands/

Reference documentation: https://docs.anthropic.com/en/docs/claude-code/slash-commands

First, ask the user for:
1. The command name (what comes after /project:)
2. A brief description of what the command should do
3. The detailed instructions/prompt for the command

Then:
1. Generate the appropriate cat command with proper heredoc syntax
2. Show the full command to the user for review
3. Ask for confirmation before executing
4. Only execute the cat command after user approval

The generated command should follow the format:
```
cat > ~/.claude/commands/<name>.md << EOF
---
description: "<description>"
---

<detailed instructions>
EOF
```

Make sure to properly escape any special characters and use correct heredoc syntax.
