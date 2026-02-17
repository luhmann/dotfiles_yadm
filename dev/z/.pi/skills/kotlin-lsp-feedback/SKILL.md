---
name: kotlin-lsp-feedback
description: Validate Kotlin edits with kotlin-lsp diagnostics.
---

Use this skill when working on Kotlin files (`.kt`, `.kts`).

## Workflow

1. After editing or writing Kotlin files, call `kotlin_lsp_diagnostics` on each
   touched file.
2. Fix all reported **errors** first.
3. Re-run diagnostics to confirm the errors are gone.
4. Report remaining warnings separately so the user can decide whether to fix
   them now.

## Notes

- The diagnostics come from `kotlin-lsp` via `textDocument/diagnostic`
  (pull-based diagnostics).
- If diagnostics fail due workspace detection, provide `workspace` explicitly
  when calling the tool.
