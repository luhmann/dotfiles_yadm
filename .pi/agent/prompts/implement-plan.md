---
description: Launch a foreground implementation agent for an approved plan
argument-hint: "[plan-path] [workspace]"
---

Delegate implementation of an existing approved plan to the external
`pi-implement-plan` command.

Plan argument supplied to this template:

`$ARGUMENTS`

Determine the plan file as follows:

1. If the first argument was supplied, use it as the plan path.
2. Otherwise, identify the exact plan path from the current conversation.
3. If multiple plausible plans exist or no exact path is available, ask the
   user. Do not guess.
4. Resolve the path and verify that the file exists.

Determine the implementation workspace as follows:

1. If the second argument was supplied, use it as the workspace.
2. For a plan affecting one repository, use that repository root.
3. For a coordinated plan affecting several repositories, use their nearest
   common parent directory.
4. If the target repositories are ambiguous, ask the user. Do not infer the
   workspace from the plan file's scratch-directory location.
5. Resolve the workspace and verify that it exists.

Run this foreground command with the bash tool:

```bash
pi-implement-plan --workspace "<resolved-workspace>" "<resolved-plan-path>"
```

Do not implement the plan yourself and do not make edits while the command is
running. Wait for the implementation agent to finish.

After it finishes:

1. Inspect `git status --short` and `git diff` in every affected repository.
2. Read the implementer's reported checks and blockers.
3. Review the changes for code quality and readability.
4. Report the resulting changes, checks, and unresolved problems to the user.
5. Do not commit or push unless explicitly requested.
