---
name: jira
description: >
  Interact with Jira from the command line via the `jira` CLI (jira-cli).
  Use when the user asks to view, search, create, or update Jira issues,
  mentions a ticket ID to act on, or wants Jira data in the terminal.
---

# Jira CLI

A global `jira` CLI (jira-cli) is available on PATH for working with Jira issues.

## Discovering usage

`jira --help` lists top-level commands. Drill into any subcommand with
`--help` for its full flag set, e.g. `jira issue --help`,
`jira issue create --help`, `jira issue list --help`. Always consult
`--help` rather than guessing flags.

## Resolving the ticket ID

When acting on "the current ticket", run `git branch --show-current` and
extract the leading ticket ID (pattern `^[A-Z]+-\d+`). If none can be
determined, ask the user.

## Common examples

View an issue as plain text (best for reading into context):

    jira issue view <TICKET-ID> --plain

Create a sub-task under a parent. The issue type is `Sub-Task` and the
parent is mandatory (`-P`):

    jira issue create -t "Sub-Task" -P <PARENT-ID> \
      -s "<summary>" -b "<body>" --no-input

Create a standalone issue:

    jira issue create -t Story -s "<summary>" -b "<body>" --no-input

Pass `--no-input` for non-interactive use; `-s`/`--summary` and
`-t`/`--type` are mandatory in that mode. Add components with `-C`,
labels with `-l`, priority with `-y`.

## Editing an existing comment

jira-cli can only **add** comments (`jira issue comment add`), never edit
one in place. To edit, use the Jira REST API directly. The PAT is in
`$JIRA_API_TOKEN`; server is `https://jira.zalando.net` (Jira Server /
DC, REST v2). Jira keeps edit history, so edits are reversible.

List comments to get the id:

    curl -s -H "Authorization: Bearer $JIRA_API_TOKEN" \
      "$JIRA/rest/api/2/issue/<KEY>/comment" \
      | jq -r '.comments[] | {id, author: .author.displayName, updated}'

Fetch the raw stored wiki markup (edit this, not the rendered HTML):

    curl -s -H "Authorization: Bearer $JIRA_API_TOKEN" \
      "$JIRA/rest/api/2/issue/<KEY>/comment/<ID>" | jq -r '.body'

Update in place (put the body in a JSON file to avoid shell-quoting hell):

    curl -s -X PUT -H "Authorization: Bearer $JIRA_API_TOKEN" \
      -H "Content-Type: application/json" --data @body.json \
      "$JIRA/rest/api/2/issue/<KEY>/comment/<ID>" | jq '{id, updated}'

## Verify rendering — do not trust the raw markup

Jira wiki markup has sharp edges; a payload that looks fine as text can
render as broken tables/blocks. After any create/edit, fetch the
**rendered** HTML and sanity-check structure:

    curl -s -H "Authorization: Bearer $JIRA_API_TOKEN" \
      "$JIRA/rest/api/2/issue/<KEY>?expand=renderedFields&fields=comment" \
      | jq -r '.renderedFields.comment.comments[-1].body' \
      | grep -cE '<table|<div class="code panel'

Expect the counts you intend (e.g. 1 table, N code panels). Extra tables
usually mean a `{code}`/`{noformat}` block closed early.

## Wiki-markup gotchas (Jira Server/DC)

- **`{code}` is greedy on close.** A `{code:bash} ... {code}` block ends
  at the *first* literal `{code}` it sees — including one buried in your
  content, e.g. a path like `/purchase-orders/{code}`. Everything after
  it then renders as prose, and pipe-prefixed lines (`| foo | bar |`)
  become spurious tables. Inside code blocks, never emit a literal
  `{code}` / `{noformat}` / `{panel}` token — rewrite it (`<code>`,
  `\{code\}`, or a placeholder). Same applies to nested braces of any
  macro name.
- **Leading `|` starts a table row**; leading `||` a header row. Any
  line beginning with `|` outside a code block is a table.
- **`{{monospace}}`**, `*bold*`, `_italic_`, `-strike-` — a stray one of
  these mid-word can swallow following text; escape with a leading `\`.
- Build multi-line bodies in a **JSON file with real `\n`**, not inline
  shell strings — avoids quote/escape corruption.

## Notes

- Output `--raw` returns JSON for scripting.
- `$JIRA` above = `https://jira.zalando.net`.
