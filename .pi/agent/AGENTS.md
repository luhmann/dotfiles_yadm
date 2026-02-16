# Global Development Guidelines

## TypeScript

- Never use barrel files (index.ts re-exports); import from specific modules directly

## Web Research Workflow

- If the user asks to "research", "look up", "find sources", or requests
  external/current documentation, use the `webresearch` CLI first.
- Preferred invocation: `webresearch "<query>" --json`.
- For complex or ambiguous topics, use investigate mode:
  `webresearch --mode investigate --json "<query>"`.
- When source quality is noisy, constrain domains with repeatable `--site`
  flags (e.g. official docs + GitHub) before broadening.
- Use `--round-results`, `--max-rounds`, and `--time-budget-sec` to tune
  depth/cost when needed.
- Use `--debug` when diagnosing low-quality retrieval/ranking behavior.
- Summarize findings with source URLs and call out uncertainty/conflicts.
- If `webresearch` is unavailable, report that clearly and ask the user to
  install/expose it on `PATH`.
- If API keys are missing, report the exact env vars required:
  `BRAVE_API_KEY` and `ANTHROPIC_API_KEY`.

## gdoc Tool Workflow

- A global `gdoc` CLI is available on PATH for exporting Google Docs.
- Always run `gdoc --help` first when you need usage/flag details.
- When the user asks to "read a google doc", invoke `gdoc` to fetch it.
