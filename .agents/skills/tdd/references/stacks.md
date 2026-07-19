# Per-Stack Encoding Reference

How to translate a specification ("under scenario A, X happens") into a test in
each ecosystem found in these repos. Same principles everywhere — only the syntax
and the "scenario → test structure" mapping change.

The original skill was written for RSpec, where a scenario maps to a
`context` and the outcome to an `it`. Below is the equivalent mapping per stack.

**Each repo's own `AGENTS.md` is the source of truth** for commands, test-class
naming, and stack quirks — read it first; the notes below summarize the shared
idioms but a repo can override them.

## Shared Policy (all stacks)

From the repos' AGENTS.md files:

- **Every non-data class with public methods needs a unit test.** "Data-only"
  holders (DTOs, records) are exempt.
- **Extend before adding.** Before writing a new test, review the existing test
  cases and structure; edit an existing test to cover the change where it makes
  sense. Only add a new test when an existing one can't reasonably be extended.
  (This is compatible with Canon TDD's one-test-at-a-time loop — the "new test"
  in each cycle may be a new `context`/case inside an existing class.)
- **Test classes live in the same package as the class under test.**

---

## Kotlin + Kotest `FunSpec` + MockK (Spring Boot)

Repos: purchase-orders-api-gateway, purchase-order-pdf-creator,
condition-agreement-integrator, user-authorization (Kotest parts).

Command: format then test — `./mvnw ktlint:format && ./mvnw test`, or `mvn ...`
where there's no wrapper (condition-agreement-integrator uses bare `mvn`; single
class: add `-Dtest=ClassName`).

Test-class naming (ca-integrator convention): `*Test` = unit (no Spring context);
`*IT` = DB integration (`@DataJpaTest`, embedded Postgres via Zonky), run by the
Failsafe plugin inside `mvn test` — no separate phase; `*IntegrationTest` = full
(`@SpringBootTest`, embedded Postgres, MockServer for external HTTP, REST-assured
for HTTP-level tests). Mocking: **MockK + SpringMockK**.

A scenario maps to a nested `context(...)`; the expected outcome to a `test(...)`.
Use Kotest matchers (`shouldBe`, `shouldContainExactlyInAnyOrder`). Mock only
boundaries with MockK (`mockk`, `every { } returns`, `verify`).

Spec: "when the token has a permission, the principal exposes it as an authority".

```kotlin
class TokenIntrospectorTest : FunSpec({
    context("when the token carries a permission") {
        test("the principal exposes it as a granted authority") {
            val userInfo = UserInfoDto(
                name = "John Doe",
                email = "john@example.com",
                permissions = listOf(PermissionDto(name = "view-orders")),
            )

            val authorities = userInfo.toAuthorities()

            authorities shouldContainExactlyInAnyOrder
                setOf(SimpleGrantedAuthority("view-orders"))
        }
    }
})
```

- Prefer `shouldBe` over `assertEquals`.
- Hard-code expected values; don't rebuild them from the SUT.
- `verify(exactly = 1) { mock.send(any()) }` only for genuine outgoing
  side-effects to external systems — not for intra-app collaboration.
- Use `BehaviorSpec` (`given/when/then`) only if a repo already uses it; default to
  `FunSpec` + `context`/`test` to match the majority.

---

## Kotlin / Java + JUnit 5 + Mockito / AssertJ (Spring Boot)

Repos: purchase-orders-management, purchase-orders-creator, edi-order-service,
edi-packstation, purchase-orders-ean-label-generator.

Command: `./mvnw ktlint:format && ./mvnw test` (single: add `-Dtest=ClassName`,
method: `-Dtest=ClassName#method`). edi-order-service: `./mvnw clean test` (unit),
`./mvnw clean verify` (+ integration, needs Docker).

A scenario maps to a `@Nested` class or a descriptively named `@Test`; the outcome
is the method name in plain language. Use AssertJ (`assertThat(...).isEqualTo`)
for new tests — some legacy tests still use Hamcrest. `@ParameterizedTest` for
edge cases (hard-coded expected values).

Mocking: **BDDMockito** — `given(...).willReturn(...)` or `whenever(...)`. Do **not**
use `` `when` `` with backticks from plain Mockito.

Test-class naming: `*Test` = unit (no Spring context, Mockito only);
`*ComponentTest` = MockMvc / partial Spring context (po-management extends
`AbstractComponentTest` with `@ActiveProfiles("test")` and WireMock stubs in
`src/test/resources/__files/`); `*IntegrationTest` or `*IT` = full Spring + real
DB (embedded/Testcontainers/fabric8 Docker). Test-data builders live under
`util/generators/`.

Spec: "when the order has no lines, its total is zero".

```kotlin
@Nested
inner class Total {
    @Test
    fun `is zero when the order has no lines`() {
        val order = Order(lines = emptyList())

        assertThat(order.total()).isEqualTo(Money.ZERO)
    }
}
```

For Spring slice/integration tests use the project's existing pattern. One
happy-path integration test per business scenario; push edge cases down to unit
tests. Use the real managed DB (Testcontainers/embedded as the repo already
does); mock unmanaged dependencies (message bus, third-party HTTP) and assert
exact calls.

---

## Scala + ScalaTest + Play

Repos: purchase-orders-frontend-gateway, condition-agreement.

Command: `./sbt test` (frontend-gateway ships a `./sbt`) or `sbt clean test`
(condition-agreement); single: `... "testOnly de.zalando...ClassNameSpec"`;
continuous: `~testOnly ...`; coverage (condition-agreement):
`sbt clean coverage test coverageReport`. Tests use embedded Postgres /
Testcontainers — no external DB needed.

Test classes are named `*Spec`. Use the flavor already in the repo. With
`AnyWordSpec`, a scenario is a `"when ..." should { "..." in { } }`; with
`AnyFlatSpec`, `"it should ... in { }"`.

Spec: "when the size chart is missing, lookup returns None".

```scala
class SizeChartServiceSpec extends AnyWordSpec with Matchers {
  "SizeChartService.lookup" should {
    "return None when the chart is missing" in {
      val service = new SizeChartService(charts = Map.empty)

      service.lookup("unknown") shouldBe None
    }
  }
}
```

Mockito (`mock[X]`, `when(...).thenReturn`) only at boundaries; ScalaCheck for
property-based edge cases. Assert observable results, not mock interactions, unless
the interaction *is* the boundary contract.

---

## Aurelia + Jasmine (Karma)

Repos: purchase-orders-frontend, abba-frontend, block-orders-frontend.

Command: `npm test` (runs `au test`). Specs live under `test/unit/**.spec.js`.

A scenario maps to a nested `describe`; the outcome to an `it`. Mock HTTP at the
boundary with `aurelia-http-client-mock`; assert on returned data / view-model
state, not internal calls.

Spec: "when the base url is set, requests are prefixed with it".

```javascript
describe('Rest client', () => {
  describe('when a base url is configured', () => {
    let http;
    let rest;

    beforeEach(() => {
      http = new HttpClientMock();
      rest = new Rest('/orders', http);
    });

    it('prefixes requests with the base url', done => {
      http.expect('/orders/42').withMethod('GET').respond(200, {});
      rest.get('42').then(() => done());
    });
  });
});
```

Async tests use `done` (the existing convention here); verify all expected
requests were fulfilled and no unexpected ones occurred in `afterEach`.

---

## React + Jest + Testing Library

Repo: condition-agreement-frontend.

Command: `npm test` (`jest --config config/jest/jest.config.js`).

A scenario maps to a `describe`; the outcome to an `it`. Query by user-visible
accessible roles/labels (`getByLabelText`, `findByText`); drive with `fireEvent`/
`userEvent`. Assert what the user sees — never component internals or props.

Spec: "when the user types a country name, the matching country is shown".

```javascript
describe('Purchasing country select', () => {
  it('shows the country matching the typed name', async () => {
    render(<Wrapper initialValues={{ purchasingCountry: 'FR' }} />);

    fireEvent.change(screen.getByLabelText('Purchasing Country'), {
      target: { value: 'ger' },
    });

    expect(await screen.findByText(/germany/i)).toBeInTheDocument();
  });
});
```

- Don't assert on implementation (state, called handlers) — assert on rendered
  output / DOM.
- Avoid coupling to CSS internals; prefer roles and text.

---

## OPA / Rego

Repo: purchasing-business-configurations.

Commands (mirror CI, which ignores bundle_targets/deploy/build/dist/docs/plugins):

```bash
opa fmt --fail business_configurations/ utils/
opa check . --ignore bundle_targets --ignore deploy --ignore build --ignore dist --ignore docs --ignore plugins
opa test  . --ignore bundle_targets --ignore deploy --ignore build --ignore dist --ignore docs --ignore plugins -v
```

Run `build-bundle-local.sh` before claiming a policy is correct.

Versioning shapes where tests go: policies are immutable versioned dirs. To change
behavior, copy the previous `v<N>/` to `v<N+1>/` and update its package, schemas,
and **companion `<policy>_test.rego`** — never edit a merged version's files.
`latest.rego` is a pure alias (no logic), so it is not tested directly.

A scenario maps to a `test_*` rule named for the behavior; the body asserts the
policy's decision for a concrete input. One rule per scenario.

Spec: "a non-object input normalizes to an empty object".

```rego
package utils_test

import rego.v1
import data.utils

test_object_or_empty_keeps_objects if {
	utils.object_or_empty({"name": "test"}) == {"name": "test"}
}

test_object_or_empty_normalizes_non_objects if {
	utils.object_or_empty(null) == {}
	utils.object_or_empty(42) == {}
	utils.object_or_empty(["not", "object"]) == {}
}
```

- Name the rule for the behavior, not the function mechanics.
- Use `with input as {...}` to drive policy decisions for allow/deny scenarios.
- Keep each `test_*` focused on one behavior; concrete inputs over abstractions.

---

## No Test Infrastructure

Repos: thunder-ai, assortment-core-configuration, assortment-core-scripts-and-tools,
assortment-core-tampermonkey-scripts, assortment-core-documentation.

These are plugins, environment config, ad-hoc scripts, userscripts, and docs —
there is no test harness and TDD does not apply. Do not scaffold one. If a change
here needs verification, discuss an approach (manual check, linting, a one-off
script) with the user first rather than inventing a suite.
