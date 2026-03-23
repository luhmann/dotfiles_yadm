---
name: jira-comment
description: >
  Add a comment to a Jira ticket summarizing design decisions from the current branch.
  Use when the user asks to "comment on jira", "jira comment", "summarize decisions for jira",
  or wants to document design decisions on the ticket.
argument-hint: "[TICKET-ID]"
---

# Jira Design-Decision Comment

## 1. Resolve the ticket ID

- If the user provided `$ARGUMENTS`, use that as the ticket ID.
- Otherwise, run `git branch --show-current` and extract the leading ticket ID (pattern: `^[A-Z]+-\d+`).
- If no ticket ID can be determined, ask the user for it. Do not proceed without one.

## 2. Gather context

Collect the following information to understand the design decisions made on this branch:

1. **Ticket context**: Run `jira issue view <TICKET-ID> --plain` to understand what the ticket is about.
2. **Commit history**: Run `git log main..HEAD --oneline` to see all commits on this branch.
3. **Full diff**: Run `git diff main...HEAD --stat` for a high-level change summary, then read the actual diff with `git diff main...HEAD` (or read changed files directly if the diff is too large).
4. **Unstaged changes**: Run `git diff` and `git diff --cached` to capture work-in-progress that hasn't been committed yet.

Read through the code changes carefully. Focus on identifying:
- Architectural choices (e.g., new modules, patterns, abstractions chosen)
- Technology or library decisions
- Data model decisions (new tables, schema changes, field choices)
- Trade-offs made and alternatives considered (look at commit messages for clues)
- Naming choices for key concepts
- Anything that deviates from existing codebase patterns and why

## 3. Draft the comment

**IMPORTANT — Jira Wiki Markup only.** This Jira instance does NOT support Markdown.
All formatting MUST use Jira wiki markup syntax:
- Headings: `h1.`, `h2.`, `h3.`, `h4.` etc.
- Bold: `*bold*`
- Italic: `_italic_`
- Unordered lists: `* item` (single asterisk + space), nested: `** sub-item`
- Ordered lists: `# item`
- Links: `[title|url]`
- Code: `{{inline code}}`, `{code}...{code}` for blocks
- Never use Markdown syntax (`#`, `**`, `_` for italic at line start, `-` for lists, backtick fences, etc.)

Write a Jira comment in this structure:

```
h3. Design Decisions — <branch name>

<One-sentence summary of what this branch achieves in relation to the ticket.>

h4. Decisions

* *<Decision title>* — <Concise description of what was decided.>
  _Reason:_ <Why this approach was chosen over alternatives.>

* *<Decision title>* — <Concise description.>
  _Reason:_ <Why.>

<...repeat for each distinct decision...>

{optional, only if applicable:}
h4. Open Items

* <Description of remaining work or follow-up needed>
* <Another item>
```

### Guidelines for the comment

- Keep each decision to 1–2 sentences plus a reason line. Be concise but distinct — someone reading the ticket should understand *what* was decided and *why* without reading the code.
- Only include genuine design decisions, not mechanical changes (formatting, imports, trivial renames).
- The "Open Items" section should only appear if there is genuinely outstanding work. Do not fabricate items.
- Do not repeat the ticket description back. Focus on decisions that go beyond what the ticket specified.

## 4. Confirm and post

**You MUST show the full drafted comment to the user and wait for their explicit approval before posting.** Do not post without approval. If the user requests changes, incorporate them and show the revised draft for another round of approval.

Once the user approves, post the comment using the **Jira REST API v2 directly** — do NOT use `jira issue comment add` (the `jira-cli` converts wiki markup to Markdown/ADF internally, which mangles headings, links, and formatting).

### Posting via REST API

1. Get the bearer token from the jira-cli config:
```bash
TOKEN=$(grep -A0 'pat:' ~/.config/.jira/.config.yml | head -1 | awk '{print $2}')
```
If `pat:` is not present, extract it by running `jira issue comment add <TICKET-ID> --debug "probe" 2>&1 | grep 'Authorization: Bearer'` and then delete the "probe" comment.

2. Write the comment body as a JSON file and POST it:
```bash
cat <<'BODY' > /tmp/jira-comment.json
{
  "body": "<wiki markup with \\n for newlines, quotes escaped as \\\">"
}
BODY
curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/jira-comment.json \
  "https://jira.zalando.net/rest/api/2/issue/<TICKET-ID>/comment" \
  | jq '{id, created}'
```

Using the REST API v2 preserves wiki markup exactly as written — headings (`h3.`), links (`[text|url]`), bold, italic, and `{{code}}` all render natively in Jira.

### Deleting a comment (if needed)

```bash
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  "https://jira.zalando.net/rest/api/2/issue/<TICKET-ID>/comment/<COMMENT-ID>"
```

To find a comment ID:
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://jira.zalando.net/rest/api/2/issue/<TICKET-ID>/comment" \
  | jq '[.comments[] | {id, author: .author.displayName, created}]'
```
