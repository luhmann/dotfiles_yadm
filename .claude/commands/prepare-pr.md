---
description: "Prepares changes to be pushed to github and opening the PR"
---

You are helping prepare git changes for a pull request. Follow these steps:

## 1. Analyze Current Changes

First, examine:
- Current branch name to extract the ticket number (usually at the beginning, e.g., `dgapp-7187-playlists` → ticket: `DGAPP-7187`)
- All staged changes using `git diff --cached`
- Unstaged changes using `git diff`
- Recent commit history to understand the current state
- **Optionally**: Use jira-cli (https://github.com/ankitpokhrel/jira-cli) to fetch ticket information if it helps understand the context
  - Example: `jira issue view DGAPP-7187` to see ticket description, acceptance criteria, and comments
  - This can provide valuable context about the WHY behind the changes

## 2. Understand the Changes

Analyze what has been changed and why. If you don't have enough context to understand the purpose or reasoning behind changes:
- **ASK THE USER** for clarification about intent, business logic, or design decisions
- Don't make assumptions about why changes were made

## 3. Determine PR Strategy

Evaluate if this would work better as:
- **Single PR**: All changes are tightly coupled and should be reviewed together
- **Stacked PRs**: Changes can be logically separated into dependent PRs that build on each other (see https://www.stacking.dev/)

Consider stacked PRs when:
- Changes have clear, separable concerns
- Some changes are prerequisites for others
- Reviewers would benefit from smaller, focused reviews

If stacked PRs seem appropriate, **ask the user** if they want to proceed with stacking.

## 4. Create Commits

Split the changes into logical commits where:
- Each commit represents a cohesive change
- **Tests should pass after each commit** (verify if possible)
- Commits are ordered logically (dependencies first)

For each commit message:
- Focus on **WHY** the change was made and **WHAT** changed at a high level
- Omit low-level details like "tests now pass" or "updated documentation"
- Avoid mentioning implementation details that won't matter in the future
- Add a trailer line with the ticket number: `Refs: TICKET-NUMBER`

Example format:
```
Add playlist filtering to improve content discovery

Users needed a way to filter playlists by genre and date.
Implemented filter UI and backend query support.

Refs: DGAPP-7187
```

## 5. Stacked PR Setup (if applicable)

If creating stacked PRs:
1. Keep the original branch as backup
2. Create new branches for each PR, all prefixed with the ticket number:
   - `dgapp-7187-part-1-description`
   - `dgapp-7187-part-2-description`
   - `dgapp-7187-part-3-description`
3. Each branch builds on the previous one
4. Explain the stacking strategy to the user

## 6. Final Steps

Before finishing:
- Run `npm run lint` and fix any issues
- Run `npm run build` and resolve any errors
- Run relevant tests to ensure everything passes
- Provide a summary of all commits created
- If stacked PRs, explain the dependency chain

**Remember**: Ask questions when unclear. It's better to clarify than to make incorrect assumptions about intent.
