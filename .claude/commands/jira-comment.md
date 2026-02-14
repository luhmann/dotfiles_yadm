# Jira Work Progress Comment

Add a comment to a Jira issue documenting current work progress and implementation details.

If an issue ID is provided as an argument, use it. If no issue ID is provided try to infer it from the current branch name. It should have a format like DGAPP-XXXX. Otherwise, ask the user for the issue ID.

If additional description is provided in the input, document that specific information. If no description is provided, focus on documenting the "why" behind the last implemented code changes, including:

- Reasoning for technical decisions made
- Trade-offs considered
- Implementation approach chosen
- Any challenges encountered and how they were resolved
- Next steps or remaining work

Ask the user:
1. What is the Jira issue ID? (if not provided)
2. What specific aspect of the work should be documented? (if not provided, default to explaining the "why" of recent code changes)
3. Should this comment include any specific technical details or context?

Once you have the information, prepare the comment text and ask for confirmation before posting it using:
`jira issue comment add ISSUE-ID --comment "comment text"`
