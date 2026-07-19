---
name: google-workspace
description: >
  Read Google Workspace data (Gmail, Calendar, Drive, Docs, Sheets,
  Slides, Tasks, Contacts, Chat) via the local `workspace-cli`. Use when
  the user asks to search their email, check their calendar, read a Doc
  or Sheet, find a Drive file, list tasks, or otherwise pull data from
  their own Google Workspace account.
---

# Google Workspace CLI

A global `workspace-cli` is on PATH (`~/.local/bin/workspace-cli`). It is a
thin client over the deployed Zalando Google Workspace MCP server, with
encrypted on-disk OAuth token caching so authentication happens once.

## Always target the production endpoint

The CLI defaults to a local server that isn't running. Point it at
production every time, via `--url` or env var. Do **not** use the
`wa-test` host — it has no OAuth proxy and auth fails.

```bash
export WORKSPACE_MCP_URL=https://google-workspace-mcp.wa.zalan.do/mcp
```

## Two commands

```bash
workspace-cli list                      # list all available tools (~47)
workspace-cli call <tool> key=value ... # call one tool
```

Both honour `--url` (placed before the subcommand) or `WORKSPACE_MCP_URL`:

```bash
workspace-cli --url https://google-workspace-mcp.wa.zalan.do/mcp list
```

## Arguments

Each `key=value` value is parsed as JSON, falling back to a plain string
when it is not valid JSON. So:

- Strings: `query="is:unread"` or `query=is:unread`
- Numbers/bools: `page_size=5`, `include_spam=false`
- Lists/objects need JSON: `message_ids='["19f1...","19f2..."]'`

Quote values containing shell-special characters or spaces.

## Authentication

First call opens a browser for Google consent and starts a localhost
callback listener. Tokens are then cached encrypted under
`~/.workspace-mcp/` and refreshed automatically — later calls run
non-interactively. If a run unexpectedly prompts for a browser, the
cached token expired or was revoked; the user must complete the flow once
in a real (non-sandboxed) terminal session.

## Scope: read-only

Only read tools are enabled. Expect to search/list/get, not create or
modify. Run `workspace-cli list` to see the current surface; descriptions
are the first line of each tool's docstring.

## Common workflows

Gmail (search returns IDs; fetch content in a batch):

```bash
workspace-cli call search_gmail_messages query="is:unread" page_size=5
workspace-cli call get_gmail_messages_content_batch message_ids='["<id1>","<id2>"]'
workspace-cli call get_gmail_thread_content thread_id=<id>
```

Calendar:

```bash
workspace-cli call list_calendars
workspace-cli call get_events calendar_id=primary
```

Drive / Docs / Sheets:

```bash
workspace-cli call search_drive_files query="name contains 'roadmap'"
workspace-cli call get_doc_as_markdown document_id=<id>
workspace-cli call read_sheet_values spreadsheet_id=<id> range="Sheet1!A1:D20"
```

Tasks:

```bash
workspace-cli call list_task_lists
workspace-cli call list_tasks task_list_id=<id>
```

## Pagination

List/search tools return a `page_token` (or `next_page_token`) in their
output when more results exist. Pass it back on the next call, e.g.
`workspace-cli call search_gmail_messages query="is:unread" page_token=<token>`.

## Google Chat: search is weak — do NOT use it for discovery

`search_messages` is **not** the Chat UI search. It lists ≤10 spaces ×
≤25 recent messages via `spaces.messages.list`, then substring-matches
`message.text` client-side. So it sees only a tiny recent window, can't
tokenize/rank, and ignores attachment and linked-doc titles. A negative
result means nothing.

The Chat UI search (Cloud Search index) is far stronger. Workflow:
user finds the thread in the UI, copies IDs from the URL
(`.../space/<SPACE>/<THREAD>/<MESSAGE>`), then the CLI pulls content:

```bash
workspace-cli call get_messages space_id=spaces/<SPACE> page_size=100
```

The read-only Chat surface is only `list_spaces`, `get_messages`,
`search_messages`, `download_chat_attachment` — no per-message get, so
match the message ID in `get_messages` output. `get_messages` is
newest-first with no usable `page_token`, so old history is hard to reach
— prefer IDs from the UI. The CLI's real strength is reading the Google
Docs/Sheets linked in a conversation (`get_doc_as_markdown`,
`read_sheet_values`).

## When unsure

Prefer `workspace-cli list` to discover exact tool names, then inspect a
tool's argument names from its description or by making a minimal call —
the server returns descriptive errors for missing/invalid parameters.
