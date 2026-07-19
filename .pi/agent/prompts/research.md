---
description: Broad research on a topic using web_search, fetch_content, and kagi search
argument-hint: "<topic>"
---
Research the following topic: $@

Use `web_search` and `kagi search` together for broad coverage. Both
accept multiple queries — vary phrasing, scope, and angle to surface
different sources. Run `kagi search --help` first if you're unsure of
its flags. Issue the initial batch of searches in parallel in a single
turn.

Pick the most promising URLs from the combined results and pull them
with `fetch_content` (batch independent URLs in one call). Follow up
with more targeted searches if there are obvious gaps.

Reply with a concise summary of the findings, then ask whether to
persist them as a markdown file. Only write the file after the user says
yes.

When writing the file:
- Use the project scratch `research/` directory injected via the
  scratch-workspace extension (do not hardcode a path).
- Filename: `YYYY_MM_DD_<slug>.md`, or
  `YYYY_MM_DD_<TICKET>_<slug>.md` when the current git branch starts
  with a ticket id matching `^([A-Z]+-\d+)`. Use `git branch --show-current`
  to check.
- Include inline source citations in the file.
