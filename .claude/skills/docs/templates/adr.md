# MADR Template

Use this template to create Architecture Decision Records. The format follows [MADR](https://adr.github.io/madr/) adapted to this project's style.

## Template

```markdown
# [Short Title: Action-Oriented, e.g., "Use Redis for Session Caching"]

Status: [Proposed | Accepted | Rejected | Deprecated | Superseded by ADR-NNNN]

## Context and Problem Statement

[Describe the context and problem in 2-3 sentences. Frame as a question if helpful.]

[Example: "This SvelteKit project needs persistent session storage. The current in-memory approach loses sessions on restart. We need to choose a session storage strategy that balances performance, reliability, and operational complexity."]

## Decision Drivers

* **[Driver 1]**: [Brief explanation]
* **[Driver 2]**: [Brief explanation]
* **[Driver 3]**: [Brief explanation]
* [Add more as needed]

## Considered Options

1. **[Option 1]** - [Brief description]
2. **[Option 2]** - [Brief description]
3. **[Option 3]** - [Brief description]

## Decision Outcome

Chosen option: **"[Option Name]"**, because [brief justification connecting to decision drivers].

### Consequences

* Good, because [positive impact 1]
* Good, because [positive impact 2]
* Bad, because [negative impact or trade-off]
* Neutral, because [neutral observation]

### Confirmation

The implementation can be verified by:
- [Verification method 1]
- [Verification method 2]
- [Verification method 3]

## Pros and Cons of the Options

### [Option 1]

* Good, because [advantage]
* Good, because [advantage]
* Bad, because [disadvantage]
* Bad, because [disadvantage]

### [Option 2]

* Good, because [advantage]
* Bad, because [disadvantage]
* Neutral, because [observation]

### [Option 3]

[Repeat pattern for each option]

## More Information

### [Optional: Additional Context Section]

[Any additional context, research findings, links to issues, or references that informed the decision.]

### References

- [Link to relevant documentation]
- [Link to GitHub issue or discussion]
- [Link to external resources]
```

## Naming Convention

Files should be named: `NNNN-descriptive-title.md`

- `NNNN`: 4-digit sequential number (0001, 0002, etc.)
- `descriptive-title`: Lowercase, hyphen-separated action phrase
- Examples:
  - `0001-use-postgresql-for-persistence.md`
  - `0002-implement-jwt-authentication.md`
  - `0003-adopt-monorepo-structure.md`

## Status Values

| Status | Meaning |
|--------|---------|
| Proposed | Decision is under discussion |
| Accepted | Decision has been approved and should be followed |
| Rejected | Decision was considered but not adopted |
| Deprecated | Decision is no longer relevant |
| Superseded by ADR-NNNN | Replaced by a newer decision |

## Tips for Good ADRs

1. **Title**: Use action verbs ("Use", "Implement", "Adopt", "Replace")
2. **Context**: Explain the problem, not just the solution
3. **Drivers**: Make priorities explicit—what matters most?
4. **Options**: Include at least 2-3 realistic alternatives
5. **Outcome**: Justify with reference to drivers, not just preference
6. **Consequences**: Be honest about trade-offs
7. **Confirmation**: How will you know if this was the right choice?
