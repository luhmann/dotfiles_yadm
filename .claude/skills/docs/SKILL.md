---
name: docs
description: Write documentation - ADRs (architecture decisions), README updates, technical specs, guides, or code comments. Use when documenting decisions, features, APIs, or processes.
allowed-tools: Read, Glob, Grep, Edit, Write, WebFetch, AskUserQuestion
---

# Documentation Skill

This skill helps write documentation by intelligently choosing the right format based on what's being documented.

## Workflow

### Step 1: Gather Context

Ask the user: **"What do you want to document?"**

Get a clear understanding of:

- The topic or decision to document
- Any related code or features
- The intended audience

### Step 2: Determine Documentation Type

Apply this **ADR Detection Checklist**. If 2+ of these are true, this is an ADR:

- [ ] Making a choice between **multiple technical approaches**
- [ ] Decision has **long-term implications** for the codebase
- [ ] There are clear **trade-offs** to document
- [ ] Decision affects **external dependencies** (libraries, tools, services)
- [ ] Future developers might **question why** this choice was made
- [ ] The decision **cannot easily be reversed**

**If uncertain**, ask clarifying questions:

- "Are you choosing between multiple approaches?"
- "Will this decision affect how we build things in the future?"
- "Are there trade-offs or alternatives worth documenting?"

### Step 3A: ADR Path (Architecture Decision Record)

If this IS an architectural decision:

1. **Auto-number**: Scan `docs/decisions/` to find the next sequential number

   ```bash
   ls docs/decisions/*.md | sort -r | head -1
   ```

2. **Gather information** for each MADR section:
   - Context and Problem Statement (what problem are we solving?)
   - Decision Drivers (what factors matter most?)
   - Considered Options (what alternatives exist?)
   - Decision Outcome (what did we choose and why?)
   - Consequences (good, bad, and neutral impacts)
   - Confirmation (how will we verify this works?)

3. **Research if needed**: Use WebFetch to gather information about options

4. **Generate ADR** using the template at [templates/adr.md](templates/adr.md)

5. **Write file**: `docs/decisions/NNNN-descriptive-title.md`
   - Use lowercase with hyphens
   - Title should be action-oriented (e.g., "use-redis-for-caching")

### Step 3B: Non-ADR Path (Other Documentation)

If this is NOT an architectural decision, classify the documentation type.

See [guides/doc-types.md](guides/doc-types.md) for the full reference.

**Quick classification**:

| If documenting...        | Then use...    | Location                   |
| ------------------------ | -------------- | -------------------------- |
| New feature/capability   | README update  | `README.md`                |
| Architecture/data models | Technical spec | `docs/technical-spec.md`   |
| Product vision/workflows | Product docs   | `docs/product-overview.md` |
| How to do something      | Guide          | `docs/<name>.md`           |
| Function/component API   | Code comments  | In the source file         |
| Version changes          | CHANGELOG      | `CHANGELOG.md`             |

**For each type**:

1. Read the existing document to understand its style
2. Find the appropriate section or create a new one
3. Match the existing formatting and tone
4. Use Edit tool to update (preferred) or Write for new files

### Step 4: Review with User

After generating the documentation:

1. Show the draft to the user
2. Ask for feedback
3. Make revisions as requested
4. Confirm final placement

## Key Principles

- **Match existing style**: Always read existing docs first and follow their patterns
- **Be concise**: Technical documentation should be scannable
- **Include examples**: Code snippets and concrete examples help understanding
- **Link related docs**: Reference other documentation when relevant
- **Audience awareness**: Consider who will read this (developers, users, AI agents)

## Project-Specific Conventions

This project uses:

- `docs/decisions/` for ADRs (MADR format without YAML frontmatter)
- `docs/` for technical and product documentation
- `CLAUDE.md` for AI-specific guidance
- `AGENTS.md` for workflow instructions
