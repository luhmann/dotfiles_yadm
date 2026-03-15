---
name: func-arch
description: >
  Design functional software architectures using Functional Declarative Design (FDD) methodology.
  NEVER auto-invoke this skill. Only use when the user explicitly asks for functional architecture
  design (e.g. "/func-arch", "design the architecture functionally", "functional architecture for ...").
  When invoked, the user MUST provide specific context about what to design — do not proceed without it.
---

# Functional Architecture Design

A methodology for designing software architectures rooted in Functional Declarative Design (FDD), based on Alexander Granin's *Functional Design and Architecture*. This skill guides you through designing modular, testable, low-complexity architectures using functional principles — applicable in any language that supports functional patterns.

**IMPORTANT**: This skill is never auto-invoked. Only activate when the user explicitly requests functional architecture design, and only when they provide specific context (domain, requirements, constraints). If context is missing, ask for it before proceeding.

## When the User Invokes This Skill

The user should tell you:
1. **What** they want to architect (a subsystem, service, feature, full application)
2. **Constraints** (language, existing codebase patterns, team familiarity)
3. **Scope** — are they looking for a high-level architecture, a component design, a domain model, or an interface design?

If any of these are missing, ask before proceeding.

## Phase 1: Requirements & Domain Analysis

Before designing anything, understand the domain:

1. **Study the existing codebase** — read config files, entry points, directory structure, existing patterns
2. **Build a mental mind map** of the domain — identify core concepts, their relationships, and behaviors
3. **Classify requirements**:
   - Functional requirements (what the system does)
   - Nonfunctional requirements (performance, reliability, extensibility)
4. **Identify essential vs. accidental complexity** — essential complexity is inherent to the domain and cannot be removed; accidental complexity comes from our tools and choices and must be minimized
5. **Present the domain model** to the user as a structured mind map (tree of concepts) and ask for validation

## Phase 2: Architecture Design

Design the architecture using FDD's layered approach. Read `references/methodology.md` for the full pattern catalog.

### Architecture Layers (FDD)

Every functional application should be decomposed into these layers:

| Layer | Responsibility | Purity |
|---|---|---|
| **Domain Model** | ADTs, domain types, domain logic, DSLs | Pure |
| **Business Logic** | Scenarios, workflows, orchestration using domain DSLs | Pure (ideally) |
| **Service / Application** | Configuration, initialization, lifecycle, threading, logging | Impure |
| **Persistence** | Data access abstractions, storage declarations | Pure interface, impure implementation |
| **Interoperability** | Event handling, reactive logic, cross-layer communication | Impure |
| **Presentation** | GUI, CLI, API endpoints, I/O | Impure |

The **pure layer** declares behavior but never evaluates it impurely. The **impure layer** interprets pure declarations and interacts with the outside world. Keep the impure layer as thin as possible.

### Key Design Principles

1. **Separate interface from implementation** — the functional equivalent of IoC. Use ADTs + interpreters, type classes, or the Service Handle pattern
2. **Low coupling, high cohesion** — modules should have focused responsibilities and minimal dependencies on each other
3. **Declarative over imperative** — encode actions as pure values (eDSLs), then interpret them
4. **Essential complexity only** — every abstraction must justify its existence; avoid over-engineering
5. **Divide and conquer** — modularity, interfaces, and IoC are universal principles; apply them functionally
6. **Type-driven design** — use the type system to make invalid states unrepresentable
7. **Immutability by default** — mutable state should be explicit, contained, and justified

### Choosing a Functional Interface Pattern

Select the right pattern based on the project's needs. Present trade-offs to the user:

| Pattern | Complexity | Testability | When to Use |
|---|---|---|---|
| **Service Handle** | Low | High (swap implementations via records/objects of functions) | Simple services, pragmatic codebases |
| **ReaderT / Reader** | Medium | High (inject dependencies via environment) | When you need implicit dependency injection |
| **Free Monad** | High | Very High (interpret programs differently for test/prod) | Complex DSLs, need full introspection of programs |
| **Final Tagless / mtl** | High | High (abstract over effect type) | Haskell/Scala ecosystems, composable effects |
| **Effect Systems** | Medium-High | High | Modern effect libraries (ZIO, Polysemy, Arrow) |
| **GADT** | High | High | When you need type-safe, extensible command sets |

For most Kotlin/TypeScript projects, **Service Handle** or **Reader-based** patterns give the best pragmatism-to-power ratio.

## Phase 3: Component Design

For each major component:

1. **Define the domain model** as algebraic data types (sealed classes/interfaces in Kotlin, discriminated unions in TypeScript)
2. **Design the eDSL** — what operations does this component expose? Model them as a data type
3. **Define the functional interface** — the contract between the component and its consumers
4. **Identify state management** strategy:
   - Stateless: pure functions over immutable data
   - Argument-passing state: thread state through function parameters
   - Managed state: use State monad or STM for concurrent state
   - Contained mutable state: wrap mutable state behind a pure interface
5. **Design error handling**:
   - Use typed errors (Result/Either) at domain boundaries
   - Errors are values, not exceptions — model error domains as ADTs
   - Fail fast with descriptive context
   - Handle errors at the appropriate architectural layer

## Phase 4: Present the Design

Present the architecture incrementally (following the brainstorm skill's pattern):

1. **Domain model & types** — show the core ADTs
2. **Layer topology** — diagram of layers, modules, and their relationships
3. **Key interfaces** — the functional interfaces / eDSLs for each subsystem
4. **State & effect management** — how state flows, where effects live
5. **Error handling strategy** — error domains and propagation
6. **Testing strategy** — how each layer is tested (unit test pure domain logic, integration test orchestrators)

After each section, ask: *"Does this look right so far?"*

## Phase 5: Implementation Plan

Once the design is accepted:

1. Ordered, incremental steps — each should compile and pass tests
2. Start with the domain model (pure layer) — it has zero dependencies
3. Build functional interfaces / eDSLs next
4. Wire up interpreters / implementations last (impure layer)
5. Reference specific files, modules, and patterns from the existing codebase
6. Call out risks and open questions

## Reference

For the complete pattern catalog, design heuristics, and language-specific examples, read:

```
references/methodology.md
references/examples.md
```

Always consult `references/methodology.md` when:
- Deciding between functional interface patterns (Service Handle vs Free Monad vs Final Tagless etc.)
- Designing domain models with ADTs
- Structuring eDSLs
- Handling state in a functional architecture
- Designing for testability
- Choosing error handling strategies

Always consult `references/examples.md` when:
- The user is working in Kotlin or TypeScript
- You need concrete code patterns to illustrate an architectural concept
