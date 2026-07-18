
## Testing
- **Test observable behavior, not implementation details.** Prefer tests that exercise the public boundary of a feature (e.g., call service → assert on result/DB state/published events) over tests that mock internal collaborators. Tests should break only when behavior changes, not when code is refactored. Isolated tests are warranted for self-contained logic (calculations, parsing, validation) where edge cases are hard to reach through the outer boundary.
- **Creation tests** should assert the complete resulting data set to catch missing or incorrect defaults. Every asserted value must be explicitly visible in the arrange phase — do not rely on hidden factory defaults for values that appear in assertions.
- **Focused tests** (updates, single-field mappings, edge cases) should only include the fields relevant to the behaviour under test in both arrange and assert — keep everything else at factory defaults so the test clearly communicates *what* it is checking.
- Make sure each test has visible Arrange, Act, Assert-phases, but DO NOT add comments that say exactly that
- Follow existing test patterns

## Error Handling
- Fail fast with descriptive messages
- Include context for debugging
- Handle errors at appropriate level
- Never silently swallow exceptions

## General Coding Style
- Prefer simple, elegant and easy to understand solutions at all times.
- Prefer functional programming patterns, like small functions, pipelining and composition.

## Kotlin

- Prefer scope-function pipelines (`.let`, `.also`, `.apply`) over intermediate variables when a function is a linear chain of transformations and side effects. Each step should be a single operation — break the chain if logic branches.

## TypeScript

- Never use barrel files (index.ts re-exports); import from specific modules directly

## Git
- Before committing any changes run the projects tasks for formatting, linting and the whole test suite. Check the project setup what the tools are (eg. ktlint format, maven/gradle tests)
- when opening prs on my behalf, include the ticket number in the title, have a simple description as PR body, do not include a test plan, include a link to the ticket you should be able to derive it with jira-cli. If the PR is stacked on another Branch/PR that is not `main`, then include references to all prs that need to be merged before this one can go into main

## Tools
- for researching you have the `search`- and `websearch`-skills available, additionally if they do not yield enough material you can invoke `kagi search --help` for instructions to leverage a full search engine.
- you are usually sandboxed via `agent-safehouse`, if you encounter permissions problems check ~/.config/agent-safehouse and `~/.aliases` to see the setup
- `recall` searches past agent sessions (Claude Code, Pi, Codex, OpenCode) — use `recall search --json "<query>"` to find prior conversations, `recall view <session-id>` to read them.

### Java / JDK (mise)
- Java is managed by `mise` (not asdf). Non-login shells don't have JAVA_HOME set, so `./mvnw`/`./gradlew` fail with "Unable to locate a Java Runtime".
- Fix: `export JAVA_HOME="$(mise where java <version>)"` before the build, e.g. `export JAVA_HOME="$(mise where java 21.0.2)"` (match the repo's mise/`.tool-versions` pin).

### CLI gotchas
- `rg`: ripgrep recurses by default — never add a `-r`-style flag for that. `-r`/`--replace` consumes the next token as a replacement string and rewrites matches (e.g. `rg -rln "pat"` becomes `--replace=ln` and prints garbage). Use `-l` for "files with matches".
- `rg`/Grep "No matches" can be a false negative (`.gitignore`/`.ignore`, binary/NUL files, symlinks). Never conclude code doesn't exist from an empty result in a repo you know contains it — recheck with `rg -uu "pat"` first.
- Use `rg -F` for literal strings containing `.`, `(`, `{`, `[`, `*` (e.g. `rg -F "User.findOne({id})"`); use regex mode only when you actually want a pattern.
- Prefer native `rg` flags over pipes: `-t kotlin`/`-t java`/`--glob` to filter, `-l` files-only, `-c` counts, `-C 2 -n` for context+line numbers. Avoid `rg | grep | awk` chains.
- awk here is macOS BSD awk (no `gawk`); avoid GNU-only features (`gensub`, `--version`). Prefer structured queries (`jq`, `yq`, `xmlstarlet`) over hand-rolled awk range-matching for specific JSON/YAML nodes.

### Structural search (`ast-grep`)
- Use `ast-grep` (installed) for structure-aware queries where `rg` gives noise — "who calls X", find a code shape, distinguish a call from a same-named comment/string. Stick with `rg` for plain text/known symbols.
- Syntax: `ast-grep run -p '<pattern>' --lang kotlin` (or `--lang java`). `--lang` is mandatory. Metavars: `$X` = one node, `$$$` = zero-or-more (args/stmts). E.g. `-p 'data class $N($$$)' --lang kotlin`.
- Gotcha: `-l` is `--lang`, NOT "files with matches" (opposite of `rg`/`grep`). For paths-only use `--files-with-matches`; for automation use `--json=compact`.
- Patterns match ASTs, not text: a bare `class $N { $$$ }` misses classes with modifiers/annotations. Start loose, add structure only as needed; verify a pattern with `--debug-query` if it matches nothing.
