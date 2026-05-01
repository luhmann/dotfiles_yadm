---
name: checkpoint
description: >
  Create a WIP checkpoint commit with bullet-point summary of changes.
  Use when the user asks to "checkpoint", "/checkpoint", or wants to
  save in-progress work before continuing.
---

# Checkpoint Commit

Create a WIP checkpoint commit that captures the current state of all changes.

## Steps

1. Run `git status` and `git diff` to understand what has changed
2. Stage all changes with `git add -A`
3. Create a commit using this format:

```
wip: <brief imperative summary of in-progress work>

## What

- <bullet point describing a change>
- <bullet point describing another change>

## Modules: <comma-separated list of affected modules>
```

## Rules

1. Prefix subject with `wip: ` (lowercase) — signals this is not a final commit
2. Subject after `wip: ` is imperative, capitalized, max ~65 chars
3. `## What` section: bullet points of what is partially done
4. `## Modules` section: same convention as final commits
5. Omit `## Why`, `Refs:`, and `BREAKING CHANGE:` — these belong in the final commit
6. Do NOT run formatting or linting — this is a mid-work snapshot, not a release gate

## Example

```
wip: add change-of-ownership flow for outbound items

## What

- Introduce OwnershipTransferService with basic routing logic
- Add DB migration for ownership_transfer table (incomplete)
- Wire up event listener stub — handler not yet implemented

## Modules: ownership, persistence
```
