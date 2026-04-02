---
name: commit
description: >
  Use this skill whenever the user asks to "commit", "/commit", "create a commit",
  "write a commit message", or any git commit-related work. Also applies when
  reviewing or fixing commit messages, or when the user mentions commit format,
  commit conventions, or commit style.
---

# Commit Message Format

When writing git commit messages, ALWAYS follow this exact format:

```
<Imperative subject line, capitalized, no period, max 72 chars>

## Why

<Context and reasoning for future decision-making by agents and humans.
Wrap lines at 72 characters. Explain the motivation and background.>

## What

- <High level bullet point describing a change>
- <Another bullet point>

## Modules: <comma-separated list of affected high-level modules>

Refs: <TICKET-ID>
BREAKING CHANGE: <description, ONLY if this is a breaking change>
```

## Workflow

1. Draft the commit message following the format above
2. Present the draft to the user for approval — do NOT run `git commit` until the user explicitly approves the message
3. If the user requests changes, revise and present again
4. Only commit after receiving explicit approval

## Rules

1. Subject line: Imperative mood ("Add" not "Added"), capitalized, no trailing period, max 72 chars
2. Blank line after subject
3. "## Why" section: Required. Provide context that aids future decisions for both agents and human developers
4. "## What" section: Required. High-level bullet points of what changed
5. "## Modules" section: Required. Comma-separated list on same line (e.g., `## Modules: auth, api, config`)
6. Blank lines between sections
7. "Refs:" footer: Include ticket reference. Extract the ticket ID from the branch name by running `git branch --show-current` — the ticket ID is the leading `PROJ-123` prefix (pattern: `^[A-Z]+-\d+`). If no ticket is found in the branch, ask the user
8. "BREAKING CHANGE:" footer: Only include if there are breaking changes. Omit entirely otherwise
9. All body lines wrap at 72 characters

## Example

```
Add OAuth2 login flow for external providers

## Why

Users need to authenticate via external identity providers like Google
and GitHub. This enables enterprise SSO requirements and reduces
password management burden for end users.

## What

- Implement OAuth2 authorization code flow
- Add provider configuration for Google and GitHub
- Create callback handling and token exchange

## Modules: auth, api, config

Refs: NOR-456
```
