---
description: "Read a story from jira into context"
---

Take the story id provided as arguments to this command and execute `jira issue view $ARGUMENTS --plain` to retrieve the Jira issue information. If the user did not provide a story id, check the branch name and see if you can infer it, it is usually the start of the branch name.

After retrieving the issue details:
1. Read and understand the issue description, acceptance criteria, and any other relevant details
2. Analyze how this issue relates to the current project context
3. Identify which parts of the codebase are likely affected
4. Summarize the key requirements and provide initial thoughts on implementation approach

Investigate code and use database mcp server to inspect the database schema if it is useful.

Store the issue details in context for reference throughout our conversation.
