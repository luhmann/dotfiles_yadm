---
name: test-protocol
description: >
  Create a manual test protocol for the current branch using showboat.
  Use when the user asks to "create a test protocol", "write a test protocol",
  "document test cases", "showboat test", or "/test-protocol". Also use when
  the user wants to re-run or verify an existing test protocol with showboat verify.
---

# Test Protocol Skill

Creates a living, executable test protocol document using `showboat` that
covers happy path and edge cases for the features introduced on the current
branch. The document is stored in the project scratch workspace under
`test_protocols/` and can be re-verified at any time with `showboat verify`.

## Workflow

### 1. Inspect the Tool

Always run this first — it lets you pick up new subcommands, flags, or
behaviour changes since the skill was written:

```bash
uvx showboat --help
```

Read the output carefully before proceeding.

### 2. Gather Context

```bash
# Get today's date
date +%Y_%m_%d

# Get ticket number from branch
git branch --show-current
# Extract the leading PROJ-123 prefix (pattern: ^[A-Z]+-\d+)

# Understand what changed in this branch
git log main..HEAD --oneline
git diff main...HEAD --stat
git diff main...HEAD
```

If `main` does not exist, try `origin/main` or `master`.
Read the actual changed files to understand the features introduced.

### 3. Determine the Output Path

Determine the project scratch workspace:
- Prefer the `get_scratch_path` tool when available.
- Otherwise use the scratch workspace path injected into the system prompt.

The output directory is: `~/icloud/org/_scratch/<project>/test_protocols/`

Filename format: `YYYY_MM_DD_TICKET_slug.md`
- `YYYY_MM_DD` — today's date
- `TICKET` — Jira ticket ID extracted from the branch name (e.g. `SOO-123`)
- `slug` — short kebab-case summary of what is being tested (e.g. `return-order-creation`)
- If no ticket ID is inferable, omit it: `YYYY_MM_DD_slug.md`

Example: `2025_06_12_SOO-42_return-order-creation.md`

### 4. Initialise the Document

```bash
uvx showboat init ~/icloud/org/_scratch/<project>/test_protocols/<filename> "<Title>"
```

Title format: `<TICKET>: <Human-readable feature description>`

### 5. Write the Protocol

For each test case, use `uvx showboat note` for prose and `uvx showboat exec`
for commands. Always run executable blocks so output is captured in the document.

Structure the document as follows:

#### 5a. Overview Section

```bash
uvx showboat note <file> "## Overview

<One paragraph describing what feature/change is being tested and why.
Summarise the PR/branch purpose here.>"
```

#### 5b. Prerequisites Section

```bash
uvx showboat note <file> "## Prerequisites

- <Anything that needs to be set up before testing>
- List environment variables, running services, seed data, etc."
```

#### 5c. Test Cases

Group cases by: **Happy Path**, then **Edge Cases & Error Handling**.

For each test case:

```bash
# Add a descriptive header as a note
uvx showboat note <file> "### TC-N: <Test Case Title>

**Given:** <precondition>
**When:** <action taken>
**Then:** <expected result>"

# Run the actual command and capture output
uvx showboat exec <file> bash "<the command to run>"
```

If a command fails unexpectedly, use `uvx showboat pop` to remove the bad
entry, fix the command, and retry:

```bash
uvx showboat pop <file>
```

#### 5d. Verify Section

After all cases are documented, add a final note:

```bash
uvx showboat note <file> "## Re-verification

To re-run all test cases and verify outputs still match:

\`\`\`bash
uvx showboat verify ~/icloud/org/_scratch/<project>/test_protocols/<filename>
\`\`\`

Run this command after any code change to confirm all test outputs still match."
```

### 6. Test Case Coverage Guidelines

Think through the following dimensions when designing test cases:

**Happy Path**
- The canonical success scenario with valid, typical inputs
- Verify the complete output/state, not just a single field

**Input Validation / Edge Cases**
- Missing required fields
- Null / empty / zero values
- Values at boundary limits (min, max, off-by-one)
- Duplicate entries where uniqueness is expected
- Invalid formats (bad UUID, wrong date format, negative amounts)

**State / Lifecycle Edge Cases**
- Acting on a resource in the wrong state (e.g. cancelling an already-cancelled order)
- Concurrent modifications (if applicable)
- Idempotency — running the same request twice

**Permission / Auth Edge Cases**
- Unauthenticated requests
- Requests with insufficient scope/role

**Integration Edge Cases**
- Downstream service returns an error
- Partial failures

Only include edge cases that are relevant to the feature under test.
Do not fabricate cases that cannot be exercised from the service boundary.

### 7. Re-verifying an Existing Protocol

When the user asks to re-verify or re-run a test protocol:

```bash
uvx showboat verify ~/icloud/org/_scratch/<project>/test_protocols/<filename>
```

If outputs have changed and the new behaviour is correct, update the document:

```bash
uvx showboat verify ~/icloud/org/_scratch/<project>/test_protocols/<filename> --output ~/icloud/org/_scratch/<project>/test_protocols/<filename>
```

## Notes

- Always invoke showboat via `uvx showboat` — never call it as a bare
  `showboat` command so the correct isolated version is always used.
- `uvx showboat exec` runs the command and prints stdout to the terminal so
  you can inspect results immediately and decide whether to keep or pop the
  entry.
- Always read the diff carefully before writing test cases — test what actually
  changed, not the whole application.
- Keep test commands self-contained and idempotent where possible so
  `showboat verify` can be run repeatedly without side effects.
- If the service needs to be running locally, add a prerequisite note and
  provide the startup command as an `exec` block at the top.
