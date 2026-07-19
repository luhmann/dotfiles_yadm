---
name: tdd
description: Implement a change using test-driven development with the specify-encode-fulfill workflow. Use when the user asks to "tdd", "/tdd", "do this test-first", "write a failing test first", or wants to drive a change through tests in any of the assortment-core / purchase-orders / condition-agreement repos (Kotlin/Java Maven+Spring, Scala sbt+Play, Aurelia or React frontends, or OPA/Rego policies). Adapts Canon TDD to the test stack of the repo you are in.
argument-hint: [specification]
disable-model-invocation: true
---

# Test-Driven Development

## Initial Specification

$ARGUMENTS

## The Specify-Encode-Fulfill Loop

"Specify-encode-fulfill":

1. **Specify**: Come up with the specifications for what you want to build
2. **Encode**: Encode those specifications as automated tests (executable specifications)
3. **Fulfill**: Write the code to fulfill the specifications

At a finer grain:

1. Write a list of the specifications within scope of the current TDD session
2. Encode one item in the list as an automated test
3. Change the code *just barely enough* to *make the current test failure go away*.
   Avoid "speculative coding" — if we write more code than necessary to make the
   current test failure go away, we risk having code never exercised by any test
4. Optionally refactor, but not before committing the behavior change. Never mix
   behavior changes with refactoring
5. Until the list is empty, go back to #2

This follows Kent Beck's [Canon TDD](https://tidyfirst.substack.com/p/canon-tdd).

## Clarifying Specifications

Before writing tests, follow this loop:

1. Repeat my specifications back to me in your own words
2. Ask me to confirm your articulation is correct or explain how it's wrong
3. If confirmed, proceed to writing tests; otherwise use my response and go back to step 1

Specifications take the form: "under scenario A, X happens; under scenario B, Y happens".

## Detect the Stack First

Before encoding anything, figure out which ecosystem you are in and use its
idioms. Quick detection:

```bash
ls pom.xml build.sbt package.json 2>/dev/null
[ -f pom.xml ] && grep -qi kotest pom.xml && echo "kotlin/kotest+mockk" || { [ -f pom.xml ] && echo "jvm/junit+mockito"; }
[ -f package.json ] && grep -q '"au test"' package.json && echo "aurelia/jasmine"
[ -f package.json ] && grep -q '@testing-library/react' package.json && echo "react/jest+rtl"
[ -f build.sbt ] && echo "scala/scalatest+play"
find . -name '*_test.rego' -not -path '*/.git/*' | head -1 && echo "opa/rego"
```

| Repos | Stack | Test command |
|---|---|---|
| purchase-orders-api-gateway, purchase-order-pdf-creator, condition-agreement-integrator, parts of user-authorization | Kotlin + **Kotest `FunSpec`** + **MockK** (Spring Boot) | `./mvnw ktlint:format && ./mvnw test` (ca-integrator: `mvn`) |
| purchase-orders-management, purchase-orders-creator, edi-order-service, edi-packstation, purchase-orders-ean-label-generator | Kotlin/Java + **JUnit 5** + **BDDMockito/AssertJ** (Spring Boot) | `./mvnw ktlint:format && ./mvnw test` |
| purchase-orders-frontend-gateway, condition-agreement | Scala + **ScalaTest** + Mockito/ScalaCheck (Play) | `./sbt test` / `sbt clean test` |
| purchase-orders-frontend, abba-frontend, block-orders-frontend | **Aurelia** + **Jasmine** (Karma) | `npm test` (`au test`) |
| condition-agreement-frontend | **React** + **Jest** + **Testing Library** | `npm test` |
| purchasing-business-configurations | **OPA / Rego** | `opa test . -v` |
| thunder-ai, assortment-core-* (configuration, scripts-and-tools, tampermonkey-scripts, documentation) | plugins / config / docs / ad-hoc scripts — **no test infra** | n/a |

For the **no test infra** repos, do not invent a test harness. If a change there
genuinely needs verification, discuss the approach with the user first.

Each repo's own **`AGENTS.md` is the source of truth** for exact commands,
test-class naming, and stack quirks — read it first. Then read
`references/stacks.md` for the per-ecosystem scenario→test translation, the shared
policy (every non-data public class gets a unit test; extend existing tests
before adding new ones; test classes share the SUT's package), naming
conventions, and concrete good/bad examples before writing a test.

## Workflow

1. I invoke /tdd with a draft specification
2. After back-and-forth, we agree on "final" specifications
3. See if we need to "clean the kitchen before we make dinner" (below)
4. You write just one test (per Canon TDD), using the idioms of the detected stack
5. Show me the test and ask for approval before continuing
6. Write the application code, show it to me, and ask for approval before
   committing (see "Fulfilling Test Specifications")
7. I provide a new specification and we start over from step 2

### Cleaning the Kitchen

Before you write a test, picture the test you're going to write and where you're
going to put it. Does the conceptual framework of this new behavior slot tidily
into the area of the code where we'll be adding it? If not, is there a
reconceptualizing of the current behavior that would make the result more
conceptually elegant? If such a reconceptualizing is called for, suggest it. If
the user approves, abandon the current change, get to a clean working state, and,
on a new branch, perform the refactoring. "Clean the kitchen before you make
dinner." Then pause, consult the user, and begin again.

### Fulfilling Test Specifications

Write ONLY ENOUGH CODE to make the current test failure go away. Never use
"defensive coding" — defensive coding is almost always just speculative coding,
i.e. code added without justification or feedback.

### Don't Be Sloppy

This kind of thinking is bad:

> That failure is pre-existing (unrelated to our change). Our new specs pass.
> Want me to commit and push?

We don't make dinner in a dirty kitchen. If you discover a pre-existing failure,
pause, stash your changes, fix the pre-existing failure, then resume.

### Don't Be Lazy

Don't abandon tests at the slightest difficulty (toolchain version mismatch,
sandbox quirk, etc.). Get the suite running. The whole point is the feedback loop.

## Core Test-Design Principles

These apply in every stack. Examples in `references/stacks.md` show each one in
the relevant language.

- **Tests are executable specifications.** A spec answers "in scenario X, what
  should happen?" Never assert a behavior "works correctly" or "handles" a case —
  state *what the correct behavior is*. Name the scenario and the expected outcome.
- **Test behavior, not implementation details.** Assert observable outcomes
  (return values, rendered output, persisted state, published events), not which
  internal methods were called.
- **Assert ends, not means.** Prefer asserting the real effect (a record was
  written, an event published, content appears on the page) over asserting that a
  collaborator method was invoked. Stub only what you must (external services);
  let the real code run so you can assert on real outcomes.
- **Arrange / Act / Assert.** Keep the three phases visible; do not add comments
  that merely say "Arrange/Act/Assert".
- **Assert what's essential, not what's incidental.** Drop redundant assertions
  implied by stronger ones.
- **No tautological tests.** Don't write tests that only answer "is the code I
  wrote the code I wrote?"
- **Favor concrete examples over abstractions** in test setup; hard-code expected
  values rather than recomputing them with the SUT's own logic.
- **Don't test private methods via hacks.** If you need to test it directly, make
  it public — usually an acceptable price.
- **Creation tests** assert the complete resulting data set (catch missing/wrong
  defaults); every asserted value is explicit in the arrange phase. **Focused
  tests** include only the fields relevant to the behavior under test.

After writing a test, scrutinize it against these principles; after writing the
application code, scrutinize it for speculative coding and clear naming before
asking for commit approval.
