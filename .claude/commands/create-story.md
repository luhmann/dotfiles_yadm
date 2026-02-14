# Create Jira Story

Interactive workflow to collaboratively design and create a Jira story with full specification.

## Usage

```
/create-story
```

## Workflow

### Phase 1: Discovery & Refinement

Begin with this prompt to the user:

"I've got an idea I want to talk through with you. I'd like you to help me turn it into a fully formed design and spec (and eventually an implementation plan).

Let me ask you questions to help refine the idea - I'll ask one question at a time, ideally multiple choice where possible.

**What problem are you trying to solve, or what feature do you want to add?**"

Then proceed through iterative questioning:

1. **Ask focused questions one at a time** to understand:
   - Core problem/need
   - Target users/audience
   - Expected behavior/outcomes
   - Constraints or requirements
   - Integration points with existing systems
   - Success criteria

2. **Prefer multiple choice questions** when possible, but use open-ended when needed for clarity

3. **Continue until you have enough detail** to describe:
   - What is being built
   - Why it's being built
   - How it should work
   - What success looks like

### Phase 2: Design Review

Once you understand the requirement:

1. **Present the design in sections** of 200-300 words each
2. **After each section, ask**: "Does this section look right so far?"
3. **Wait for confirmation** before proceeding to the next section
4. Cover these aspects:
   - Overview & objectives
   - User experience/interaction flow
   - Technical approach
   - Data model changes (if applicable)
   - API/integration points
   - Testing strategy
   - Success metrics

Do not go too deeply into implementation details or technical specifics. Explain the requirements of technical changes but do not provide individual line numbers or code snippets. Do explain for example required database constraints.

### Phase 3: Story Creation

When both you and the user are satisfied with the design:

1. **Propose a story title**
   - Format: Brief, action-oriented summary (e.g., "Add video quality filter to concert search")
   - Ask: "Does this title work for the story?"

2. **Gather metadata**:
   - Ask: "What epic should this belong to? (provide epic key like STAGE-123, or say 'none')"
   - Ask: "Any labels to add? (comma-separated, or 'none')"

3. **Create the story description**:
   - Format as markdown with these sections:
     ```markdown
     ## Overview
     [1-2 sentence summary]

     ## Problem Statement
     [What problem this solves]

     ## Proposed Solution
     [Detailed design from Phase 2]

     ## Acceptance Criteria
     - [ ] [Specific, testable criteria]
     - [ ] [Another criterion]

     ## Technical Notes
     [Implementation details, dependencies, risks]

     ## Testing Strategy
     [How this should be tested]

     ## Success Metrics
     [How to measure if this is successful]
     ```

4. **Show the full story to user**:
   - Display title, all metadata, and full description
   - Ask: "Ready to create this story in Jira?"

5. **Create the story**:
   ```bash
   # Save description to temp file
   cat > /tmp/jira_story_description.md << 'EOF'
   [FULL DESCRIPTION]
   EOF

   # Create the story
   # Note: --parent flag ONLY works if parent issue is type "Epic"
   jira issue create \
     -t Story \
     -s "[TITLE]" \
     -y [PRIORITY] \
     --template /tmp/jira_story_description.md \
     [--parent EPIC-KEY if parent is type Epic] \
     [-l label1 -l label2 if provided] \
     --no-input

   # If parent is NOT an Epic (e.g., it's a Story), link after creation:
   # Available link types: 'Blocks', 'Cloners', 'Duplicate', 'Polaris work item link', 'Problem/Incident', 'Relates'
   # Example: jira issue link NEW-STORY-KEY PARENT-KEY "Relates"

   # Clean up
   rm /tmp/jira_story_description.md
   ```

6. **Confirm creation**:
   - Display the created story key (e.g., STAGE-456)
   - Provide link if available from jira-cli output
   - If parent was not an Epic, link the new story to the parent using appropriate link type (typically "Relates")
   - Confirm the linking was successful
   - Ask: "Would you like to create an implementation plan for this story?"

## Notes

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice when possible** - Makes it easier to answer
- **Confirm each design section** - Ensure alignment before moving forward
- **Show full story before creating** - Last chance to review
- **Story description uses markdown** - Jira will render it properly
- **Custom fields** - If story points or other custom fields are needed, use `--custom` flag with field IDs from your Jira instance
- **Epic vs Story parent** - The `--parent` flag only works if the parent issue is type "Epic". If linking to a Story or other issue type, create the story first then use `jira issue link` with an appropriate link type (typically "Relates")

## Example Question Flow

```
Q: What problem are you trying to solve, or what feature do you want to add?
A: [User describes need]

Q: Who is the primary user for this?
   A) End users (audience)
   B) Admin users
   C) Internal developers
   D) External partners
A: [User selects]

Q: Is this:
   A) A completely new feature
   B) An enhancement to existing functionality
   C) A bug fix or correction
   D) A refactoring/technical improvement
A: [User selects]

[Continue with specific questions based on answers...]
```

## Jira CLI Configuration

Ensure jira-cli is configured with:
- Project set (e.g., `jira init`)
- Authenticated to your Jira instance
- Default project configured

Test with: `jira issue list --limit 1`
