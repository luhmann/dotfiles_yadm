---
description: Search past Claude Code conversations and retrieve Q&A pairs. Use when user asks to look up, remember, or recall previous discussions. Default shows question+answer pairs. Use --full for entire conversation, --all for all projects.
---

# Recall Past Conversations

User's request: $ARGUMENTS

## Step 1: Extract Search Terms

Analyze the user's request and extract 1-3 relevant search keywords. Do NOT use the raw input.

Examples:
- "what did we discuss about open source datasets?" → search: `datasets`
- "remember that conversation about refactoring the auth system?" → search: `auth refactor`
- "look up when we talked about SvelteKit hooks" → search: `sveltekit hooks`
- "find our discussion on caching strategies" → search: `caching`

Choose terms that are:
- Specific and distinctive (not common words like "the", "about", "we")
- Likely to appear in the actual conversation
- Technical terms, project names, or key concepts

## Step 2: Execute Search

Run with your extracted terms (add flags as needed):

```bash
claude-recall <your-extracted-terms> [--all] [--full] [--exact]
```

**Flags:**
- `--all` - Search all projects (use if current project has no results)
- `--full` - Show entire conversation (use if user wants full context)
- `--exact` - Exact substring match (use if fuzzy returns too many false positives)

## Step 3: Interpret Results

The output shows:
- **Project path** and **Session ID** (usable with `claude --resume <id>`)
- **Q&A pairs**: Matching user questions AND the assistant's answers

## Step 4: Present to User

1. **Answer their question** - Summarize what was discussed/concluded
2. **Key findings** - Specific recommendations, decisions, or code produced
3. **Session reference** - Mention session ID if they want to resume

## If No Results

1. Try broader or alternative search terms
2. Add `--all` to search across all projects
3. Try `--exact` if fuzzy matching is too loose
4. Ask user for more context about what they remember
