---
name: start-story
description: >
  Start working on a Jira story: read the ticket, create a feature branch, and add a tracking entry
  to the org file. Use when the user asks to "start story", "start ticket", "begin work on",
  or provides a ticket number to start working on.
argument-hint: "<TICKET-ID>"
---

# Start Story

## 1. Resolve the ticket ID

- If the user provided `$ARGUMENTS`, use that as the ticket ID.
- Otherwise, ask the user for the ticket ID. Do not proceed without one.

## 2. Read the Jira story

Use the `/jira-read` skill with the ticket ID to fetch and understand the story.

Run: `/jira-read <TICKET-ID>`

From the story, extract:
- **Ticket ID** (e.g., `ULTRA-1234`)
- **Story title** (the summary field)

## 3. Create a feature branch

1. Ensure you are on `main` (or the project's default branch) and it is up to date:
   ```bash
   git checkout main && git pull
   ```
2. Create a new branch named `<TICKET-ID>/<short-description>` where:
   - `<TICKET-ID>` is the Jira ticket ID in its original casing (e.g., `ULTRA-1234`)
   - `<short-description>` is a kebab-case slug (3-5 words) derived from the story title
   - Example: `ULTRA-1234/add-partner-invoice-export`
3. Switch to the new branch:
   ```bash
   git checkout -b <branch-name>
   ```

## 4. Add entry to zalando.org

Add an org-mode entry under the `* Stories` top-level heading in `~/icloud/org/zalando.org`.

- If the `* Stories` heading does not exist yet, create it at the end of the file.
- Add a new entry in this format:

```org
** TODO <TICKET-ID> <Story title>
```

Do not add any additional content below the heading — just the TODO entry.

## 5. Confirm

Summarize what was done:
- The ticket that was read
- The branch that was created
- The org entry that was added
