---
name: jf-test
description: "Write high-value unit and integration tests for features, classes, or modules. Use this skill whenever the user asks to write tests, add test coverage, create a test suite, test a feature, write unit tests, write integration tests, add specs, or asks 'how should I test this'. Also trigger when the user asks to review existing tests for quality, refactor tests, reduce test brittleness, or fix flaky tests. This skill encodes a principled methodology — use it even for simple 'write tests for this function' requests so that every test delivers real value. Do NOT use for running or debugging existing test failures — only for writing, reviewing, or improving tests."
---

# Unit Testing Skill

A principled methodology for writing high-value tests, based on the framework from *Unit Testing: Principles, Practices, and Patterns* (Vladimir Khorikov). This skill ensures every test you write provides genuine protection against regressions without becoming a maintenance burden.

## Before You Start

Before writing any test, read `methodology.md` in this skill's directory for the full decision framework. The summary below is your quick-start checklist — the reference file contains the detailed reasoning, examples, and anti-patterns you'll need for non-trivial cases.

## Quick-Start Checklist

### 1. Classify the Code Under Test

Categorize every piece of code into one of four quadrants:

| | Few Collaborators | Many Collaborators |
|---|---|---|
| **High complexity / domain significance** | **Domain Model & Algorithms** → Unit test extensively | **Overcomplicated Code** → Refactor first, then test |
| **Low complexity / domain significance** | **Trivial Code** → Don't test | **Controllers / Orchestrators** → Integration test |

If the code mixes business logic with orchestration (overcomplicated code), **stop and refactor before writing tests**. Push decisions into domain classes; make the controller a thin shell.

### 2. Write Unit Tests (Domain Logic)

For every domain class, algorithm, or calculation:

**Structure:** Arrange–Act–Assert, one logical action per test.

**Name tests in domain language:**
```
// GOOD — describes behavior from the domain perspective
Changing_email_from_corporate_to_non_corporate_lowers_employee_count

// BAD — describes the implementation
ChangeEmail_calls_SetType_and_decrements_count
```

**Assert only observable outputs:**
- Return values
- Changed public state
- Raised domain events

**Never assert:**
- Which internal methods were called
- The order of internal operations
- Intermediate state that isn't part of the public API

**Parameterize to cover edge cases cheaply.** Always hardcode expected values — never recompute them inside the test using the same logic as the SUT.

**Reuse fixtures via factory methods, not shared constructors:**
```
// GOOD
private static User CreateUser(string email = "default@test.com", UserType type = UserType.Regular)
    => new User(email, type);

// BAD — shared constructor setup couples all tests to each other
public MyTests() { _user = new User("test@test.com", UserType.Regular); }
```

### 3. Write Integration Tests (Controllers / Orchestrators)

**Coverage rule:** One happy-path integration test per business scenario — pick the longest path that touches all out-of-process dependencies. Add integration tests only for edge cases that unit tests cannot cover.

**Dependency handling:**

| Dependency Type | Examples | In Tests |
|---|---|---|
| **Managed** (you control it, only your app uses it) | Your database | Use the real thing; assert final state |
| **Unmanaged** (externally visible side effects) | Message bus, SMTP, third-party APIs | Mock it; assert exact messages/calls sent |

**Never mock managed dependencies.** Verifying SQL queries or repository calls couples you to implementation details.

**Always verify the number of calls to mocked unmanaged dependencies** — catching unexpected interactions matters as much as catching missing ones.

### 4. Audit Every Test

Before committing, check each test against the four pillars:

1. **Protection against regressions** — Does it exercise meaningful, complex code? (If it only covers a trivial getter → delete it.)
2. **Resistance to refactoring** — Could I restructure the SUT's internals without breaking this test? (If it asserts internal method calls → rewrite it.)
3. **Fast feedback** — Unit test runs in ms; integration test runs in low seconds? (If it takes minutes → optimize.)
4. **Maintainability** — Can a new team member read this and understand the business scenario it protects?

**If any pillar scores zero, the test does not belong in the suite.**

### 5. Anti-Patterns to Block

When writing or reviewing tests, actively reject these patterns:

- **Testing private methods directly** → Test through the public API instead; if the private method is too complex, extract it into its own class
- **Exposing private state for testability** → Find the public surface that production code uses
- **Reimplementing the algorithm in the test** → Hardcode expected results instead
- **Mocking intra-system communications** → Only mock at the application boundary (external systems)
- **Code pollution** (adding `isTestEnvironment` flags to production code) → Use dependency injection
- **Asserting interactions with stubs** → Stubs are for input; only mocks (outgoing calls) should be asserted

## Adapting to the Project

### Detecting the test framework
Before writing tests, identify the project's testing stack:
```bash
# Look for existing tests and test config
find . -name "*.test.*" -o -name "*_test.*" -o -name "*Test.*" -o -name "*spec.*" | head -20
cat package.json 2>/dev/null | grep -E "jest|vitest|mocha|pytest|junit|xunit|nunit|rspec|go test"
cat pyproject.toml 2>/dev/null | grep -E "pytest|unittest"
ls **/pom.xml **/build.gradle 2>/dev/null
```
Match the existing conventions: test file naming, assertion style, directory structure, and fixture patterns. If no tests exist, ask the user what framework they prefer.

### Language-specific patterns
After identifying the framework, apply the principles using idiomatic patterns for that ecosystem. The methodology is language-agnostic — the four pillars, the code quadrant classification, and the anti-patterns apply equally to TypeScript/Jest, Python/pytest, C#/xUnit, Java/JUnit, Go/testing, Ruby/RSpec, etc.

## Reference

For the complete methodology including detailed reasoning, worked examples, the Humble Object pattern, hexagonal architecture guidance, and the full anti-pattern catalog, read:

```
methodology.md
```

Always consult the reference when:
- Deciding whether to refactor before testing
- Dealing with overcomplicated code that mixes logic and orchestration
- Choosing what to mock and what to use directly
- Reviewing existing tests for quality
- The user asks *why* a particular testing approach is recommended
