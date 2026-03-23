## Philosophy
- Be critical, be wise, be elegant, ask questions when you are unsure.
- If you are not very sure about an approach offer me several options, each with a confidence on 1 to 10-scale

## Testing
- **Test observable behavior, not implementation details.** Prefer tests that exercise the public boundary of a feature (e.g., call service → assert on result/DB state/published events) over tests that mock internal collaborators. Tests should break only when behavior changes, not when code is refactored. Isolated tests are warranted for self-contained logic (calculations, parsing, validation) where edge cases are hard to reach through the outer boundary.
- **Creation tests** should assert the complete resulting data set to catch missing or incorrect defaults. Every asserted value must be explicitly visible in the arrange phase — do not rely on hidden factory defaults for values that appear in assertions.
- **Focused tests** (updates, single-field mappings, edge cases) should only include the fields relevant to the behaviour under test in both arrange and assert — keep everything else at factory defaults so the test clearly communicates *what* it is checking.
- Make sure each test has visible Arrange, Act, Assert-phases, but DO NOT add comments that say exactly that
- Follow existing test patterns

### Core Beliefs

- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Learning from existing code** - Study and plan before implementing
- **Pragmatic over dogmatic** - Adapt to project reality
- **Clear intent over clever code** - Be boring and obvious
- Prefer functional programming patterns, like small functions, pipelining and compositon.

### Simplicity Means

- Single responsibility per function
- Avoid premature abstractions
- No clever tricks - choose the boring solution
- If you need to explain it, it's too complex

### Learning the Codebase

- Find 3 similar features/components
- Identify common patterns and conventions
- Use same libraries/utilities when possible

### Error Handling

- Fail fast with descriptive messages
- Include context for debugging
- Handle errors at appropriate level
- Never silently swallow exceptions

## Naming

- Avoid the `Data` suffix on classes — it adds no context since everything is data. Use contextual suffixes that communicate the class's role: `Payload` (event/message body), `Request`, `Response`, `Model`, `Info`, etc.

## Kotlin

- Prefer scope-function pipelines (`.let`, `.also`, `.apply`) over intermediate variables when a function is a linear chain of transformations and side effects. Each step should be a single operation — break the chain if logic branches.

## TypeScript

- Never use barrel files (index.ts re-exports); import from specific modules directly

## PRS
- when opening prs on my behalf, include the ticket number in the title, have a simple description as PR body, do not include a test plan, include a link to the ticket you should be able to derive it with jira-cli. If the PR is stacked on another Branch/PR that is not `main`, then include references to all prs that need to be merged before this one can go into main
