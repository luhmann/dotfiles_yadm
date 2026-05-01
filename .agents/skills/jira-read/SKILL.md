---
name: jira-read
description: >
  Read a story from Jira into context. Use when the user asks to "read a story",
  "read the ticket", "jira read", or wants to understand a Jira issue before working on it.
argument-hint: "<TICKET-ID>"
---

# Read Jira Story

## 1. Resolve the ticket ID

- If the user provided `$ARGUMENTS`, use that as the ticket ID.
- Otherwise, run `git branch --show-current` and extract the leading ticket ID (pattern: `^[A-Z]+-\d+`).
- If no ticket ID can be determined, ask the user for it. Do not proceed without one.

## 2. Fetch the issue

Run `jira issue view <TICKET-ID> --plain` to retrieve the Jira issue information.

## 3. Analyze the issue

After retrieving the issue details:

1. Read and understand the issue description, acceptance criteria, and any other relevant details
2. Analyze how this issue relates to the current project context
3. Identify which parts of the codebase are likely affected
4. Summarize the key requirements and provide initial thoughts on implementation approach

Store the issue details in context for reference throughout the conversation.
