---
name: n2c-pr-review
description: >
  Convert n2c review notes left in changed files into pending GitHub PR review
  comments. Use when the user asks to turn n2c comments into PR feedback,
  review notes, pending review comments, or gh pr-review comments.
argument-hint: ""
---

# n2c Pending PR Review

Turn `n2c:` comments in local files into pending inline GitHub PR review
comments using the `gh pr-review` extension. The user stays in control of every
remote-state-changing action.

## Non-negotiable safety rules

1. Never submit the review. Do not run `gh pr-review review --submit`.
2. Every `gh pr-review review --start` and `--add-comment` call changes remote
   GitHub state. Ask for explicit approval immediately before each one.
3. A pending review must be started before adding any inline comments. Do not
   call `--add-comment` until a `--start` command has returned a `PRR_...`
   review id.
4. Add comments only to that pending review, never as standalone published PR
   comments.
5. Show the exact comment body and command before running it.
6. If a command fails before changing state, explain the failure and ask before
   retrying.

## Workflow

### 1. Find changed files and read the n2c notes

By default, scan all changed files. Do not require the user to pass a file or PR.
Use the PR base when available; otherwise fall back to the current Git status.

Useful commands:

```sh
BASE=$(git merge-base origin/master HEAD 2>/dev/null || git merge-base origin/main HEAD 2>/dev/null || true)
if [ -n "$BASE" ]; then
  git diff --name-only "$BASE"...HEAD
else
  git diff --name-only HEAD && git ls-files --others --exclude-standard
fi
```

Then search only those changed files for `n2c:` comments:

```sh
git diff --name-only "$BASE"...HEAD | xargs rg -n "n2c|N2C"
```

If the local branch is stale but the PR head exists on the remote, compare
against the remote PR head instead of local `HEAD`.

- Locate all `n2c:` comments with line numbers.
- Read the surrounding code for each comment.
- Understand whether the note should become review feedback.
- For each note, discuss the proposed comment with the user. Keep review
  comments concise and concrete.

### 2. Resolve PR and head commit read-only

Use read-only commands first:

```sh
gh pr view --json number,url,headRefName,headRefOid
```

If the local branch is stale or not checked out at the PR head, pass the PR
head commit explicitly to `--commit`. This avoids starting the pending review on
the wrong commit.

Also verify target line numbers from the PR head, not from local files that may
include `n2c` comments:

```sh
git show <headRefOid>:<path> | nl -ba | sed -n '<start>,<end>p'
```

### 3. Draft comments locally

For each approved note, create a local temp body file. This is local-only and
safe.

```sh
cat > /tmp/<slug>-review-1.md <<'EOF'
<Comment body>
EOF
```

For suggested code changes, use GitHub suggestion blocks on the exact commented
range. The suggestion must contain the full replacement for the selected line or
multi-line range, with indentation exactly as it should appear after applying:

````markdown
```suggestion
<replacement code for the selected range>
```
````

Attach single-line suggestions to `--line <line>`. Attach multi-line suggestions
with `--start-line <start-line>` and `--line <end-line>` so GitHub knows which
range the replacement applies to.

### 4. Start a pending review first — approval required

You cannot add pending inline comments until a pending review exists. Start the
review first, then use its returned `PRR_...` review id for every later
`--add-comment` command.

Show the command and ask for approval before running it:

```sh
gh pr-review review <pr-number> \
  --repo <owner/repo> \
  --start \
  --commit <headRefOid>
```

Record the returned review id, e.g. `PRR_...`. If no review id is returned, stop
and do not try to add comments.

### 5. Add each pending inline comment to the started review — approval required each time

For a single-line comment:

```sh
gh pr-review review <pr-number> \
  --repo <owner/repo> \
  --review-id <PRR_...> \
  --add-comment \
  --path <path> \
  --line <line> \
  --side RIGHT \
  --body "$(cat /tmp/<slug>-review-1.md)"
```

For a multi-line comment or suggestion:

```sh
gh pr-review review <pr-number> \
  --repo <owner/repo> \
  --review-id <PRR_...> \
  --add-comment \
  --path <path> \
  --start-line <start-line> \
  --line <end-line> \
  --start-side RIGHT \
  --side RIGHT \
  --body "$(cat /tmp/<slug>-review-2.md)"
```

After each command, report the returned thread id and confirm that the comment is
pending.

### 6. Edit pending comments when the user revises wording

Editing an existing pending review comment is also remote-state-changing. Ask
for explicit approval before editing.

First check whether the installed extension supports pending comment edits:

```sh
gh pr-review review --help | rg "edit-comment|comment-id"
```

If the extension supports it, prefer the extension command:

```sh
gh pr-review review <pr-number> \
  --repo <owner/repo> \
  --edit-comment \
  --comment-id <PRRC_...> \
  --body "$(cat /tmp/<slug>-updated.md)"
```

If the installed extension does not support `--edit-comment`, check whether the
feature has since landed upstream before falling back. Use read-only checks such
as release notes, pull requests, or the extension repository. Do not upgrade the
extension without user approval.

Current fallback: use GitHub GraphQL directly with the same mutation proposed by
upstream `gh-pr-review` edit support:

```sh
gh api graphql \
  -f query='mutation($id: ID!, $body: String!) {
    updatePullRequestReviewComment(input: {
      pullRequestReviewCommentId: $id,
      body: $body
    }) {
      pullRequestReviewComment { id }
    }
  }' \
  -f id='<PRRC_...>' \
  -f body="$(cat /tmp/<slug>-updated.md)"
```

To find pending comment ids when `gh-pr-review review view` cannot show pending
reviews, query the pending review directly with `gh api graphql` and select the
needed `PRRC_...` comment node id.

### 7. Remove converted n2c notes locally

Once a pending comment has been added successfully, remove the corresponding
`n2c:` note from the local code so review notes do not accumulate in the working
tree. Only remove the `n2c:` note that was converted; do not change surrounding
production code unless the user separately asks for it.

Use exact edits. For inline notes, remove only the trailing note, preserving the
code before it. For standalone notes, remove the whole comment line.

### 8. Final state

- Do not submit the review.
- Tell the user the review remains pending and must be submitted in the GitHub UI
  or by them explicitly outside this skill.
- Optionally show a summary of pending thread ids and target lines.

## Tone for review comments

- Be direct and concrete.
- Prefer asking for a specific change over broad critique.
- Use suggestions for code when the fix is clear.
- Avoid over-explaining unless the risk is subtle.
