---
name: plan
description: >
  Iterative pair-planning session that produces a concrete implementation plan.
  Use when the user asks to "plan", "/plan", "make a plan", "create a plan",
  "plan out", or wants to think through an implementation before coding.
argument-hint: "<TICKET-ID or task description>"
---

# Plan — Iterative Pair-Planning

You are pair-planning with the user. Explore the codebase to build context,
ask the user questions when you hit decisions you can't make alone, and write
your findings into a plan file as you go.

**The plan file is the ONLY file you may edit.** No code changes.

## Plan File Setup

1. Determine the **ticket ID**:
   - If `$ARGUMENTS` looks like a ticket ID (e.g. `PT-12345`), use it.
   - Otherwise, extract from the current branch: `git branch --show-current`
     (pattern: `^[A-Z]+-\d+`).
   - If neither works, ask the user.

2. Determine the **task description**:
   - If `$ARGUMENTS` is free-form text, use it.
   - If only a ticket ID is available, read the ticket with `jira-cli` to get
     the summary.

3. Determine the project scratch workspace:
   - Prefer the `get_scratch_path` tool when available.
   - Otherwise use the scratch workspace path injected into the system prompt.

4. Create the plan file under the project scratch `plans/` directory:
   ```
   ~/icloud/org/_scratch/<project>/plans/<DATE>_<TICKET-ID>_<short-name>.org
   ```
   - `<DATE>` is today in `YYYY_MM_DD` format
   - `<TICKET-ID>` is the Jira ticket ID
   - `<short-name>` is a kebab-case slug (3–5 words) derived from the task
   - If no ticket ID is inferable, omit it: `<DATE>_<short-name>.org`
   - Example: `2026_04_07_PT-50123_add-retry-on-timeout.org`

## The Loop

Repeat this cycle until the plan is complete:

1. **Explore** — Use `read` and `bash` (grep, find, ls) to read code. Look
   for existing functions, utilities, and patterns to reuse.
2. **Update the plan file** — After each discovery, immediately capture what
   you learned. Don't wait until the end.
3. **Ask the user** — When you hit an ambiguity or decision you can't resolve
   from code alone, ask. Batch related questions together. Then go back to
   step 1.

## First Turn

Start by quickly scanning a few key files to form an initial understanding of
the task scope. Then write a skeleton plan (headers and rough notes) and ask
the user your first round of questions. Don't explore exhaustively before
engaging the user.

## Asking Good Questions

- **Never ask what you could find out by reading the code.**
- Batch related questions together.
- Focus on things only the user can answer: requirements, preferences,
  tradeoffs, edge case priorities.
- Scale depth to the task — a vague feature request needs many rounds; a
  focused bug fix may need one or none.

## Plan File Structure

Organize the plan with clear org-mode headings. Fill sections incrementally as
you learn more.

```org
#+title: <TICKET-ID>: <Title>
#+date: <YYYY-MM-DD>

* Context
Why this change is being made — the problem, what prompted it, the intended
outcome.

* Approach
Your recommended approach. Discuss alternatives with the user while uncertain,
but converge on one recommended approach in the final plan and justify it.

* Steps

** Step 1: <Title>
*Files:* =path/to/file.kt=
What to do, referencing existing functions/utilities to reuse.
*Verify:* How to confirm this step works.

** Step 2: <Title>
...

* Verification
How to test the changes end-to-end (run the code, run tests, manual checks).
```

### Plan Content Guidelines

- Discuss alternatives while planning when there is uncertainty
- Keep the final plan focused on your recommended approach, not all alternatives
- Keep it concise enough to scan quickly, detailed enough to execute
- Include the paths of critical files to be modified
- Reference existing functions and utilities to reuse, with their file paths
- Each step should be independently verifiable where possible

## When to Converge

The plan is ready when you've addressed all ambiguities and it covers:
- **What** to change
- **Which files** to modify
- **What existing code** to reuse (with file paths)
- **How to verify** the changes

Before asking for final approval, check whether the user has added `n2c:`
annotations to the plan. If annotations exist, address each one by one: state
your understanding, discuss the issue, propose a resolution, and update the
plan file. Repeat until no annotations remain.

When ready, present a brief summary of the plan and ask the user for final
approval. Do not ask for approval via a question buried in other text —
make it a clear, explicit request.

## Ending Your Turn

Your turn should only end by either:
- Asking the user a question to gather more information
- Presenting the completed plan for approval
