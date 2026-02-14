---
description: "Create a WIP checkpoint commit with bullet-point summary of changes"
---

Create a checkpoint commit with all current changes.

First check git status and git diff to understand what has changed. Then:

1. Stage all changes with `git add .`
2. Create a commit with message format:
   ```
   wip: <brief summary>

   • <bullet point of change 1>
   • <bullet point of change 2>
   • <bullet point of change 3>
   ```

The commit message should:
- Start with "wip: " followed by a very brief summary
- Include bullet points for each significant change
- Document the "why" if it's important for understanding the change
- Keep bullet points concise but informative enough for crafting final commit messages later

This creates a checkpoint before making further changes.
