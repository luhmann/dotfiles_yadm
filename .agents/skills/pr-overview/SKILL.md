---
name: pr-overview
description: >
  Triage all your open GitHub PRs across every repo and surface feedback you
  need to address. Use when the user asks to "check my PRs", "pr overview",
  "what feedback do I have", "any review activity", or wants a to-do list of
  outstanding PR comments/reviews since they last looked.
---

# PR Overview & Feedback Triage

Wraps `~/dev/gh-pr-overview.sh`, which gathers the user's authored open PRs and
raw activity signals. Your job is the judgment layer: turn those signals into a
short, actionable triage of what actually needs the user's attention.

Scope: by default only `zalando-partner` PRs are reported. The org's GitHub
search index is locked down for external members, so the script enumerates via
`viewer.pullRequests` (which bypasses search) and filters by owner. This means
only PRs the user **authored** are returned — not ones where they are merely a
reviewer. Override the org with `GH_PR_OVERVIEW_ORG=<org>` or set it to empty
for all orgs.

## 1. Gather

Run the script in JSON mode (read-only, safe):

```shell
~/dev/gh-pr-overview.sh --json
```

This returns `{ me, org, generatedAt, prs: [...] }`. Each PR carries:

- `newActivityCount` — activity newer than the user's last check
- `reviewDecision`, `approvedReviews`, `changesRequested` — explicit GitHub verdicts from others
- `approvalEmojiCount` — comments/reviews from others containing ✅ (this environment uses ✅ as an informal approval)
- `openThreads[]` — unresolved review threads, each with `opener`, `firstComment`, `lastReplyBy`, `iRepliedLast`, `replyCount`, `outdated`, `newSinceCheck`
- `threadsAwaitingMe` — count of unresolved threads where the user did NOT reply last

## 2. Triage (your judgment)

For each PR, decide and report:

- **Does it need action?** A thread needs action when `iRepliedLast == false`
  (someone asked something and the user hasn't responded). Threads where the
  user replied last are waiting on the reviewer — note them but don't flag as a
  to-do.
- **Approval status.** Decide what approval means in context: an `approvalEmojiCount`
  or `approvedReviews` with **zero** outstanding `changesRequested` and **zero**
  `threadsAwaitingMe` → treat as ✅ ready. If there's a ✅ alongside unaddressed
  change-requests or open questions, say "approved but N items still open" — do
  not call it done.
- **Ignore noise.** Skip bot comments (dependabot, CI, github-actions) and the
  user's own comments when deciding what needs addressing. The script already
  excludes the user from `threadsAwaitingMe`, but reviewer threads may still
  contain bot chatter — use the `firstComment` text to judge.
- **Summarize the ask.** For each thread awaiting the user, read `firstComment`
  and state in one line what the reviewer wants, with the file path if present.

## 3. Report

Lead with the headline, then per-PR detail. Suggested shape:

```
N open PRs · M with new activity · K awaiting your reply

⚠ repo#num — <title>
   <one-line: what needs doing, e.g. "2 unanswered threads">
   • <reviewer> on <path>: <summarized ask>
   • ...

✅ repo#num — <title>  (approved, nothing outstanding)

· repo#num — <title>  (waiting on reviewer / no activity)
```

Order: PRs needing action first, then approved/ready, then quiet ones.

## 4. Mark as seen — ASK FIRST

After presenting, ask whether to stamp these PRs as seen so the next run's
"new since last check" is accurate. Only if the user confirms:

```shell
~/dev/gh-pr-overview.sh --mark-seen
```

Do not mark seen automatically — the user may want to revisit the same activity.

## Notes

- Thread *resolution* state comes from GraphQL (`isResolved`); resolved threads
  are already excluded, so every listed thread is genuinely open.
- State lives at `~/dev/.gh-pr-overview/last-checked.json` (per-PR timestamps).
  `--reset` clears it. (Path is under `~/dev` because that is the only
  sandbox-writable location in this environment.)
- The bare `~/dev/gh-pr-overview.sh` (no args) prints a compact human summary if
  the user just wants a glance without triage narrative.
