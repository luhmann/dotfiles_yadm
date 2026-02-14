# Documentation Types Guide

This guide helps you choose the right documentation type and location for non-ADR documentation.

## Quick Reference

| Documentation Type | Best For | Location | Action |
|-------------------|----------|----------|--------|
| README update | New features, setup changes, quickstart | `README.md` | Edit existing sections |
| Technical spec | Architecture, data models, config | `docs/technical-spec.md` | Add new section |
| Product docs | Capabilities, workflows, user features | `docs/product-overview.md` | Add new section |
| Guide/How-to | Step-by-step procedures | `docs/<name>.md` | Create new file |
| Code comments | Function/component API docs | Source files | Add inline |
| CHANGELOG | Version history, release notes | `CHANGELOG.md` | Prepend entry |
| AI guidance | Claude Code instructions | `CLAUDE.md` | Edit existing |
| Agent workflow | Automation procedures | `AGENTS.md` | Edit existing |

## Detailed Type Descriptions

### README Updates

**When to use**: Documenting changes that affect how users interact with the project.

**Good candidates**:
- New commands or scripts
- Setup/installation changes
- New environment variables
- Project structure changes
- New dependencies

**Format**:
- Keep it scannable with headers and bullet points
- Include code blocks for commands
- Link to detailed docs for complex topics

**Location**: Edit the appropriate section in `README.md`

---

### Technical Specification

**When to use**: Documenting internal architecture, data models, or technical details.

**Good candidates**:
- Database schema changes
- API contract definitions
- Configuration options
- System architecture diagrams
- Integration patterns

**Format**:
- Use ASCII diagrams for visual architecture
- Include SQL for data models
- Add example configurations
- Document error codes and edge cases

**Location**: Add a new section to `docs/technical-spec.md` or create `docs/<topic>-spec.md` for major features

---

### Product Documentation

**When to use**: Documenting what the product does from a user perspective.

**Good candidates**:
- New capabilities or features
- User workflows
- Use cases
- Feature comparisons

**Format**:
- Focus on benefits and outcomes
- Use scenarios and examples
- Avoid implementation details

**Location**: Add to `docs/product-overview.md`

---

### Guides and How-Tos

**When to use**: Step-by-step instructions for accomplishing specific tasks.

**Good candidates**:
- Setup procedures
- Migration guides
- Troubleshooting guides
- Integration tutorials
- Development workflows

**Format**:
```markdown
# [Task] Guide

## Prerequisites
- [What you need before starting]

## Steps

### Step 1: [Action]
[Instructions]

### Step 2: [Action]
[Instructions]

## Verification
[How to confirm success]

## Troubleshooting
[Common issues and solutions]
```

**Location**: Create `docs/<topic>-guide.md`

---

### Code Comments and JSDoc

**When to use**: Documenting functions, components, or complex code sections.

**Good candidates**:
- Public API functions
- Complex algorithms
- Non-obvious code behavior
- Component props and events

**Format** (TypeScript/JavaScript):
```typescript
/**
 * Brief description of what this does.
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 *
 * @example
 * ```ts
 * const result = functionName(arg);
 * ```
 */
```

**Format** (Svelte):
```svelte
<!--
  @component ComponentName

  Brief description of the component.

  @prop {type} propName - Description

  @example
  ```svelte
  <ComponentName prop={value} />
  ```
-->
```

**Location**: Inline in the source file, immediately before the code being documented

---

### CHANGELOG

**When to use**: Documenting version changes and release notes.

**Good candidates**:
- New features
- Bug fixes
- Breaking changes
- Deprecations

**Format** (Keep a Changelog style):
```markdown
## [Unreleased]

### Added
- New feature description

### Changed
- Change description

### Fixed
- Bug fix description

### Removed
- Removed feature description
```

**Location**: Prepend to `CHANGELOG.md` (create if it doesn't exist)

---

### AI Guidance (CLAUDE.md)

**When to use**: Instructions specifically for Claude Code or AI assistants.

**Good candidates**:
- Preferred commands and workflows
- Project-specific conventions
- Testing requirements
- Commit policies

**Location**: Edit `CLAUDE.md`

---

### Agent Workflow (AGENTS.md)

**When to use**: Documenting automated workflows and procedures.

**Good candidates**:
- Completion checklists
- Multi-step procedures
- Quality gates
- Handoff protocols

**Location**: Edit `AGENTS.md`

## Decision Tree

```
What are you documenting?
│
├── A technical choice between options?
│   └── → ADR (see templates/adr.md)
│
├── How to USE something (external)?
│   └── → README.md
│
├── How something WORKS (internal)?
│   └── → docs/technical-spec.md
│
├── WHAT the product does?
│   └── → docs/product-overview.md
│
├── HOW to do something step-by-step?
│   └── → docs/<topic>-guide.md
│
├── WHAT a function/component does?
│   └── → Code comments (inline)
│
├── WHAT changed in a release?
│   └── → CHANGELOG.md
│
└── Instructions for AI/automation?
    ├── General AI guidance → CLAUDE.md
    └── Workflow procedures → AGENTS.md
```
