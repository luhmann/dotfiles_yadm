# Unit Testing Methodology — Full Reference

This reference contains the complete reasoning, decision frameworks, and worked examples behind the unit testing skill. Read this when you need the "why" behind a recommendation, or when you're dealing with a non-trivial testing decision.

## Table of Contents

1. [The Goal of Unit Testing](#the-goal)
2. [The Four Pillars of a Good Test](#four-pillars)
3. [The Test Pyramid and Test Distribution](#test-pyramid)
4. [Classifying Code: The Four Quadrants](#four-quadrants)
5. [The Humble Object Pattern](#humble-object)
6. [Hexagonal Architecture and Testability](#hexagonal)
7. [Observable Behavior vs. Implementation Details](#observable-vs-implementation)
8. [Mocks, Stubs, and When to Use Each](#mocks-and-stubs)
9. [Managed vs. Unmanaged Dependencies](#dependencies)
10. [Writing Unit Tests: Detailed Guide](#writing-unit-tests)
11. [Writing Integration Tests: Detailed Guide](#writing-integration-tests)
12. [Anti-Patterns: Full Catalog](#anti-patterns)
13. [Step-by-Step Workflow for a Feature](#workflow)
14. [Worked Example: Change User Email](#worked-example)

---

<a name="the-goal"></a>
## 1. The Goal of Unit Testing

The goal is to **enable sustainable growth of the software project**. Tests are a safety net that lets you add features and refactor with confidence. Without good tests, every change risks regressions and the project eventually stagnates.

Key insight: **not all tests are equal**. A bad test is worse than no test — it costs maintenance time, produces false alarms, and erodes trust in the suite. Every test must justify its existence through the value it provides relative to its upkeep cost.

Test code is a liability, not an asset. More tests is not automatically better. A small number of highly valuable tests outperforms a large number of mediocre ones.

The cost of a test includes:
- Time spent refactoring the test when underlying code changes
- Time spent running the test on each code change
- Time spent investigating false alarms
- Time spent reading the test to understand the underlying behavior

---

<a name="four-pillars"></a>
## 2. The Four Pillars of a Good Test

Every automated test can be scored on four attributes. They **multiply** together — if any one is zero, the test is worthless.

### Pillar 1: Protection Against Regressions

How likely is the test to catch a real bug? This increases with:
- Amount of code exercised
- Complexity of that code
- Domain significance of that code

Trivial code (simple getters, one-line property assignments) offers almost no protection — don't test it.

To maximize this pillar: exercise as much code as possible, including external libraries and frameworks in the testing scope.

### Pillar 2: Resistance to Refactoring

Can the test survive an internal restructuring that doesn't change observable behavior?

Tests coupled to **implementation details** (which methods are called, which SQL is generated, which internal classes are used) break on every refactoring, producing **false positives** (false alarms).

This is the most important attribute because it is **largely binary** — a test either has resistance to refactoring or it doesn't. There is no meaningful middle ground. Always maximize this pillar.

False positives are devastating over time:
- They dilute your ability to react to real problems
- You lose trust in the test suite
- You stop refactoring, which accelerates code rot
- Real bugs get ignored along with the noise

The only way to achieve resistance to refactoring: **verify the end result the SUT delivers (its observable behavior), not the steps it takes to do that.**

### Pillar 3: Fast Feedback

How quickly does the test run? Slow tests discourage frequent execution and lengthen the feedback loop. Unit tests should run in milliseconds. Integration tests should run in low seconds.

### Pillar 4: Maintainability

Two components:
- **Readability**: Fewer lines = more readable (don't artificially compress, though)
- **Operational cost**: Tests with out-of-process dependencies cost more to keep running

### The Trade-Off

The first three pillars are **mutually exclusive** — you cannot maximize all three simultaneously. Since resistance to refactoring is non-negotiable, the practical trade-off is:

**Protection against regressions ←→ Fast feedback**

This trade-off defines the Test Pyramid: unit tests maximize speed; end-to-end tests maximize regression protection; integration tests balance the two.

Maintainability is independent of the other three (except that end-to-end tests are inherently harder to maintain due to their size and dependency requirements).

---

<a name="test-pyramid"></a>
## 3. The Test Pyramid and Test Distribution

```
        /  E2E  \          ← Few: slow, expensive, best regression protection
       /----------\
      / Integration \      ← Moderate: balance of speed and coverage
     /----------------\
    /    Unit Tests     \  ← Many: fast, cheap, cover all edge cases
   /____________________\
```

**Distribution rule:**
- **Unit tests**: Cover all edge cases of domain logic. These are your workhorse tests.
- **Integration tests**: One happy-path test per business scenario (the longest path touching all out-of-process dependencies). Plus edge cases that unit tests can't reach.
- **End-to-end tests**: Only the most critical paths where production failure cost is very high. One or two per critical workflow. Often optional.

For simple projects with little domain complexity, the pyramid flattens — more integration tests relative to unit tests.

---

<a name="four-quadrants"></a>
## 4. Classifying Code: The Four Quadrants

All production code falls onto a 2×2 matrix:

**Vertical axis:** Complexity + Domain Significance (cyclomatic complexity, business rule importance)
**Horizontal axis:** Number of Collaborators (mutable dependencies, out-of-process dependencies)

### Quadrant 1: Domain Model & Algorithms (top-left)
High complexity/significance, few collaborators.
→ **Unit test extensively.** These tests are highly valuable (good regression protection) and cheap (few dependencies to set up).

### Quadrant 2: Trivial Code (bottom-left)
Low complexity, few collaborators. Simple getters, property assignments, trivial wiring.
→ **Don't test.** Near-zero chance of finding a bug.

### Quadrant 3: Controllers / Orchestrators (bottom-right)
Low complexity, many collaborators. Thin code that loads data, delegates to domain logic, saves results, sends messages.
→ **Integration test.** Cover the happy path and verify orchestration works.

### Quadrant 4: Overcomplicated Code (top-right)
High complexity AND many collaborators. Fat controllers, god objects, methods that make decisions AND talk to databases.
→ **Refactor first.** Split into domain logic (Quadrant 1) + controller (Quadrant 3). Then test each appropriately.

**The most important refactoring principle**: The more important or complex the code, the fewer collaborators it should have. Code can be either deep (complex) or wide (many dependencies), but never both.

---

<a name="humble-object"></a>
## 5. The Humble Object Pattern

To split overcomplicated code:

1. **Extract the testable logic** out of the code that has hard-to-test dependencies
2. The original code becomes a thin, "humble" wrapper — it glues the dependency and the extracted logic together, but itself contains little or no logic
3. The extracted logic can now be tested independently

This pattern appears everywhere:
- **Hexagonal architecture**: Domain layer (logic) vs. Application services (orchestration)
- **Functional architecture**: Functional core (pure logic) vs. Mutable shell (side effects)
- **MVC/MVP**: Model (logic) vs. Controller/Presenter (glue)
- **DDD Aggregates**: Reduce connectivity between classes into testable clusters

The key metaphor: **code depth vs. code width**. Controllers are wide (many arrows out) but shallow (little logic). Domain classes are deep (complex logic) but narrow (few dependencies).

---

<a name="hexagonal"></a>
## 6. Hexagonal Architecture and Testability

A well-structured application has two layers:

**Domain Layer** (center):
- Contains all business logic
- Has NO out-of-process dependencies
- Only depends on other domain classes
- Represents domain knowledge (the "how-to's")

**Application Services Layer** (outer):
- Orchestrates the domain layer
- Communicates with the external world (DB, APIs, message bus)
- Contains NO business logic
- Represents business use cases (the "what-to's")

This separation means:
- Domain classes can be tested with fast, isolated unit tests — no mocks needed for in-process dependencies
- Application services are tested with integration tests — real managed dependencies, mocked unmanaged dependencies

Tests working with different layers have a **fractal nature**: they verify the same behavior at different levels. An integration test verifies the overall business use case. A unit test verifies a subgoal on the way to that use case. Both should be traceable back to a business requirement.

---

<a name="observable-vs-implementation"></a>
## 7. Observable Behavior vs. Implementation Details

All code can be classified along two independent dimensions:
- **Public API vs. Private API** (visibility)
- **Observable behavior vs. Implementation details** (purpose)

For code to be part of **observable behavior**, it must do one of:
- Expose an operation that helps a client achieve a goal
- Expose a state that helps a client achieve a goal

**A well-designed API**: Observable behavior = Public API. Implementation details = Private API.

**A leaky API**: Implementation details are exposed publicly. This invites tests to couple to them, creating brittleness.

### How to test correctly

The best test tells a **story about the problem domain**. If the test fails, that failure means there's a disconnect between the story and the application's actual behavior.

```
// GOOD — tests the observable result
[Fact]
public void Rendering_a_message()
{
    var sut = new MessageRenderer();
    var message = new Message { Header = "h", Body = "b", Footer = "f" };
    string html = sut.Render(message);
    Assert.Equal("<h1>h</h1><b>b</b><i>f</i>", html);
}

// BAD — tests the implementation structure
[Fact]
public void MessageRenderer_uses_correct_sub_renderers()
{
    var sut = new MessageRenderer();
    var renderers = sut.SubRenderers;
    Assert.Equal(3, renderers.Count);
    Assert.IsAssignableFrom<HeaderRenderer>(renderers[0]);  // coupled to internals
}
```

The first test treats the SUT as a black box. The second breaks if you rearrange, rename, or replace sub-renderers — even if the HTML output stays the same.

---

<a name="mocks-and-stubs"></a>
## 8. Mocks, Stubs, and When to Use Each

All test doubles fall into two types:

**Mocks** — emulate and examine **outgoing** interactions (commands that produce side effects).
Example: Verifying an email was sent to an SMTP server.

**Stubs** — emulate **incoming** interactions (queries that return data).
Example: Returning a fake user object from a database.

### Critical Rules

1. **Never assert interactions with stubs.** Verifying that a stub was called couples you to implementation details. Stubs are for setup, not for verification.

2. **Mocks are for inter-system communications only.** Mocking calls between classes inside your application (intra-system) creates brittle tests. Only mock at the application boundary — where your system talks to external systems.

3. **Intra-system communications are implementation details.** How domain classes collaborate internally has no direct connection to client goals. Coupling to these collaborations leads to fragile tests.

4. **Inter-system communications are observable behavior.** The way your system talks to external applications is part of its contract. Backward compatibility must be maintained. Mocks are appropriate here.

### Mock vs. Stub Decision

```
Is the dependency OUTSIDE your application boundary?
├── YES: Is the interaction an outgoing command (side effect)?
│   ├── YES → Use a MOCK. Assert the interaction.
│   └── NO (it's a query) → Use a STUB. Don't assert the interaction.
└── NO (it's inside your application):
    └── Don't use test doubles at all. Use real instances.
        (Exception: managed out-of-process deps like your DB — use the real thing in integration tests)
```

---

<a name="dependencies"></a>
## 9. Managed vs. Unmanaged Dependencies

**Managed dependencies**: Out-of-process dependencies you fully control. Only your application accesses them. Interactions with them are NOT visible externally.
- Example: Your application's database.
- In tests: **Use the real instance.** Assert the final state, not the queries.

**Unmanaged dependencies**: Out-of-process dependencies whose interactions are visible to the external world.
- Examples: SMTP server, message bus, third-party APIs.
- In tests: **Replace with mocks.** Assert exact messages/calls, including the count.

Why this distinction matters:
- Mocking a managed dependency (like your DB) couples tests to implementation details (which SQL gets generated) and sacrifices resistance to refactoring.
- Using a real unmanaged dependency (like an SMTP server) would send actual emails during tests.

If a database is shared with other applications, treat the shared tables as unmanaged (mock them) and the private tables as managed (use real).

---

<a name="writing-unit-tests"></a>
## 10. Writing Unit Tests: Detailed Guide

### Test Structure: Arrange–Act–Assert

- **Arrange**: Set up the SUT and its dependencies. Can be multiple lines.
- **Act**: Invoke the behavior under test. **Exactly one action.** If you need multiple acts, you're probably testing an integration scenario.
- **Assert**: Verify the outcome. Multiple assertions are fine if they verify different facets of the same result.
- No `if` statements in tests — ever. Each branch should be a separate test case.

### Naming

Name tests in plain language describing the scenario and expected outcome from the domain perspective. Avoid method names, underscores-as-spaces is fine, use whatever convention the project already follows.

Good patterns:
- `[Scenario]_[Expected outcome]`
- `[State under test]_[Action]_[Expected result]`

### Parameterized Tests

Use parameterized tests (Theory/InlineData, pytest.mark.parametrize, test.each, etc.) to cover many input combinations cheaply. Always hardcode expected values:

```
// GOOD — expected values are hardcoded
[InlineData(1, 3, 4)]
[InlineData(11, 33, 44)]

// BAD — expected value is computed (reimplements the algorithm)
int expected = value1 + value2;
```

### Test Fixture Reuse

Use **private factory methods** with sensible defaults:
```
private static User CreateUser(
    string email = "test@example.com",
    UserType type = UserType.Regular,
    bool isActive = true)
    => new User(email, type, isActive);
```

Avoid shared constructors/setup methods — they couple all tests in the class, reduce readability (you can't see the full arrangement at a glance), and introduce hidden dependencies between tests.

### Assertion Libraries

Use fluent assertion libraries (FluentAssertions, assertpy, chai, etc.) when available. They improve readability:
```
// Standard
Assert.Equal(expected, actual);

// Fluent
actual.Should().Be(expected);
```

---

<a name="writing-integration-tests"></a>
## 11. Writing Integration Tests: Detailed Guide

### Scenario Selection

1. Pick the **longest happy path** — the one that goes through all out-of-process dependencies.
2. If no single path touches all dependencies, write additional integration tests until every external system is covered.
3. Add edge cases only when they **can't be covered by unit tests** AND they don't fail fast (i.e., they could silently corrupt data rather than crash immediately).

### Fail Fast Principle

If an incorrect execution of an edge case **immediately crashes the application** (e.g., a precondition throws), don't write an integration test for it. The bug would reveal itself on first execution and can't corrupt data. A unit test on the precondition itself is sufficient.

### Database Handling

- Each developer gets their own database instance.
- Keep schema in source control (migrations or state-based).
- Clear data between test runs (truncate tables at the start of each test, not at the end).
- Never use in-memory databases as substitutes — they differ in behavior from real databases.
- If you can't use a real database, **don't write integration tests at all**. Focus on unit tests instead of writing integration tests with a mocked database.

### Reusing Code in Test Sections

- **Arrange**: Use Object Mother or Builder patterns — factory methods that create pre-configured entities in the database.
- **Act**: Extract the controller/service invocation into a helper method when multiple integration tests call the same endpoint.
- **Assert**: Create custom assertion methods for verifying database state (e.g., `AssertUserInDatabase(userId, expectedEmail, expectedType)`).

### Managing Transactions

Use a single transaction per test that encompasses the full arrange-act-assert cycle. This ensures cleanup and consistency.

---

<a name="anti-patterns"></a>
## 12. Anti-Patterns: Full Catalog

### 1. Testing Private Methods

**Problem**: Exposes implementation details, creates coupling, damages resistance to refactoring.
**Solution**: Test through the public API. If the private method is too complex to cover indirectly, it's a **missing abstraction** — extract it into its own class with its own public API.
**Exception**: Private constructors used by ORMs are part of observable behavior (the contract with the ORM). Making them public (or using reflection) for testing is acceptable.

### 2. Exposing Private State for Testing

**Problem**: Production code doesn't need the field to be public, so exposing it couples tests to implementation details.
**Solution**: Assert through the same public surface that production code uses. If production code checks a discount percentage (not a status enum), test the discount percentage.

### 3. Leaking Domain Knowledge to Tests

**Problem**: Reimplementing the algorithm in the test makes it impossible to distinguish real bugs from implementation changes.
**Solution**: Hardcode expected results. Pre-calculate them using domain expertise, a spreadsheet, or legacy code output — anything other than the SUT.

### 4. Code Pollution

**Problem**: Adding `isTestEnvironment` booleans or test-only interfaces to production code.
**Solution**: Use proper dependency injection. The production code should be unaware of tests.

### 5. Mocking Concrete Classes

**Problem**: Creates partial mocks that are fragile and confusing.
**Solution**: Mock interfaces that represent boundaries. If no interface exists and you need a test double, introduce one at the boundary.

### 6. Asserting Interactions with Stubs

**Problem**: Stubs provide input data. Asserting they were called couples you to how the SUT retrieves data, not what it does with it.
**Solution**: Only assert outgoing interactions (mocks). Let stubs be silent providers.

### 7. Working with Time

**Problem**: Using `DateTime.Now` or `time.time()` directly makes tests non-deterministic.
**Solution**: Inject time as an explicit dependency — either as a function/lambda or as an interface. Never use ambient context (static `TimeProvider.Current`) — it introduces shared mutable state between tests.

---

<a name="workflow"></a>
## 13. Step-by-Step Workflow for a Feature

### Step 1: Map the Architecture
Identify the domain classes involved (business rules, decisions, calculations) and the controller/service that orchestrates them. List out-of-process dependencies and classify each as managed or unmanaged.

### Step 2: Refactor Toward Testability
If the code mixes logic and orchestration, split it. Push decisions into domain classes with zero out-of-process dependencies. Make the controller a thin orchestrator. Use the CanExecute/Execute pattern for conditional logic that spans the boundary.

### Step 3: Write Unit Tests for Domain Logic
Cover every meaningful business rule, calculation, state transition, validation, and precondition. Parameterize edge cases. Hardcode expected values. Assert only outputs and public state.

### Step 4: Write Integration Tests for the Controller
One happy path per business scenario. Use real managed dependencies. Mock unmanaged dependencies. Verify database final state and exact messages sent to external systems.

### Step 5: Audit Each Test
Run through the four pillars. Delete any test that scores zero on any pillar. Prefer no test over a bad test.

---

<a name="worked-example"></a>
## 14. Worked Example: Change User Email

**Feature**: A user changes their email address. If they switch from a corporate to a non-corporate email (or vice versa), the company's employee count updates, and a notification is sent to a message bus.

### Architecture
- **Domain classes**: `User`, `Company` (business rules)
- **Controller**: `UserController` (orchestration)
- **Managed dependency**: Database
- **Unmanaged dependency**: Message bus

### Unit Tests (Domain Layer)

```
1. Changing_email_from_corporate_to_non_corporate
   - User type changes to Non-corporate
   - Company employee count decreases by 1
   - EmailChangedEvent is raised with correct data

2. Changing_email_from_non_corporate_to_corporate
   - User type changes to Corporate
   - Company employee count increases by 1
   - EmailChangedEvent is raised

3. Changing_to_the_same_email
   - No state changes
   - No events raised

4. Changing_email_of_deactivated_user (precondition)
   - CanChangeEmail returns error string

5. Various email inputs (parameterized)
   - Edge cases: empty string, very long email, special characters
```

### Integration Test (Controller)

```
1. Changing_email_from_corporate_to_non_corporate
   - Arrange: Insert user (corporate) and company into real database
   - Act: Call controller.ChangeEmail(userId, newNonCorporateEmail)
   - Assert:
     - User in database has new email and Non-corporate type
     - Company in database has decremented employee count
     - Mock message bus received exactly one SendEmailChangedMessage call
       with the correct userId and newEmail
     - No other messages were sent
```

### What is NOT tested:

- The trivial `CanChangeEmail` guard in the controller (fails fast → app crashes → obvious)
- Which SQL queries the repository generates (implementation detail)
- The order of `SaveUser` vs `SaveCompany` calls (implementation detail)
- Getter/setter properties on `User` or `Company` (trivial code)
