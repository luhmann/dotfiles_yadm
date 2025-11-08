-   In plan mode present a detailed, step-by-step implementaton plan to me
-   If you are not very sure about an approach offer me several options, each with a confidence on 1 to 10-scale
-   Always backup factual claims with sources
-   Ask me questions if you are not sure about requirements or what best to do
-   Always run tests you have edited
- NEVER use an MCP server without me explicitly asking for it
- If the user refers to a ticket number, you can usually find it at the beginning of the current branch name
- when I ask you to commit changes run formatting, linting and resolve all diagnostic issues before.

# Development Guidelines

## Philosophy

### Core Beliefs

- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Learning from existing code** - Study and plan before implementing
- **Pragmatic over dogmatic** - Adapt to project reality
- **Clear intent over clever code** - Be boring and obvious

### Simplicity Means

- Single responsibility per function
- Avoid premature abstractions
- No clever tricks - choose the boring solution
- If you need to explain it, it's too complex

### Learning the Codebase

- Find 3 similar features/components
- Identify common patterns and conventions
- Use same libraries/utilities when possible
- Follow existing test patterns

### Error Handling

- Fail fast with descriptive messages
- Include context for debugging
- Handle errors at appropriate level
- Never silently swallow exceptions
