# FDD Methodology — Complete Pattern Catalog

## Core Philosophy

Functional Declarative Design (FDD) is the functional counterpart to Object-Oriented Design (OOD). Where OOD uses classes, interfaces, inheritance, and encapsulation, FDD uses:

- **Algebraic Data Types (ADTs)** instead of class hierarchies
- **Pattern matching** instead of virtual dispatch
- **Higher-order functions** instead of strategy/command patterns
- **Monads and effect systems** instead of implicit side effects
- **eDSLs + interpreters** instead of service layers with hidden effects

The central insight: **finding the essence of a domain means finding its mathematical invariants**. When you discover that your data type is a functor, a monoid, or a monad, you gain access to a proven library of combinators and laws — dramatically increasing the power and correctness of your code.

## FDD Design Diagramming Methodology

FDD introduces its own lightweight diagramming approach for iterative architecture design:

1. **Mind Maps** — Tree-like diagrams for requirements analysis. Start with a central domain concept and expand associatively. Good for brainstorming and organizing requirements without rigid structure. Each level adds granularity.

2. **Necessity Maps** — Concept maps showing what components the system needs. Round nodes represent actors (GUI, spaceship, simulator), rectangular nodes represent subsystems. Arrows show "uses" and "interacts with" relationships. Purpose: define the big picture of what must exist.

3. **Elements Diagrams** — Informal concept maps for brainstorming *how* to implement what the necessity map identified. All elements are equal (no central node). Label elements with their nature: Subsystem (SS), Library (L), Concept (C), Data (D), Model (M). Tag each element with its architecture layer (AL, DM, IL, BL, PL, VL). Purpose: discover requirements during design.

4. **Architecture Diagrams** — Formal, tree-like diagrams (no cycles allowed). Use "burger blocks" showing component + implementation. Relations are "interacts with" (bidirectional) or "uses" (unidirectional). This is the final artifact of the design phase.

**Iterative process**: Requirements -> Mind Maps -> Necessity Maps -> Elements Diagrams -> Architecture Diagrams -> Implementation. Return to any earlier phase when new information emerges.

## Design Principles

### Essential vs. Accidental Complexity

- **Essential complexity** is inherent to the problem domain — it cannot be removed
- **Accidental complexity** comes from our tools, abstractions, and implementation choices — it must be minimized
- The main task of software design is to **keep accidental complexity as low as possible** without sacrificing other factors
- Every abstraction must justify its existence: if it removes more complexity than it introduces, keep it; otherwise, delete it

### The Three Success Factors

Balance these three competing factors throughout design:

1. **Goals accomplished** — deliver on time, meet quality/budget expectations
2. **Compliant with requirements** — the system does what it's supposed to do
3. **Constant simplicity** — the system stays maintainable and understandable

### Functional Design Principles (mapped from SOLID)

| OOD Principle | FDD Equivalent |
|---|---|
| **SRP** (Single Responsibility) | Small, focused functions and modules |
| **OCP** (Open/Closed) | ADTs + pattern matching (extend with new operations via new functions) |
| **LSP** (Liskov Substitution) | Type class laws / behavior contracts on interfaces |
| **ISP** (Interface Segregation) | Fine-grained type classes / small eDSLs |
| **DIP** (Dependency Inversion) | Functional interfaces: ADTs + interpreters, type classes, Service Handle, Free Monads |

### Immutability, Purity, and Determinism

- **Immutability by default**: bind variables to expressions, don't assign them
- **Pure functions**: no side effects, same inputs always produce same outputs
- **Deterministic behavior**: pure code is predictable and testable
- **Pyramidal code**: pure functions compose into pure functions; impurity "infects" upward — keep the impure layer thin

### Type-Driven Design

- Design starts with types — model the domain in the type system
- Use ADTs to make invalid states unrepresentable
- The type system is a language of correctness: leverage it to catch errors at compile time
- Strong types reduce the need for debugging
- Use newtypes/branded types to prevent argument mixups (e.g. `ControllerName` vs `ComponentIndex` — both strings, but not interchangeable)

### Encapsulation in FP

- **Modules** are the primary encapsulation unit — export types without their constructors to make them opaque/abstract
- **Smart constructors** create values of opaque types while enforcing invariants (functional equivalent of Factory Method)
- **Internal modules** — mark unstable internals with an `Internal` namespace as a warning; keep them public for testing but mandate they are never imported by production code
- Separate types from behavior in modules: types in one module, operations in another — this prevents forced exposure of internals

## Architecture Patterns

### Layered Architecture (FDD)

```
┌─────────────────────────────────────┐
│        Application Layer            │  Impure: config, init, lifecycle
├─────────────────────────────────────┤
│        Business Logic Layer         │  Pure: scenarios, workflows using eDSLs
├─────────────────────────────────────┤
│        Service Layer                │  Functional interfaces to subsystems
├─────────────────────────────────────┤
│        Domain Model Layer           │  Pure: ADTs, domain logic, eDSLs
├─────────────────────────────────────┤
│        Persistence Layer            │  Pure interface / impure implementation
├─────────────────────────────────────┤
│        Interoperability Layer       │  Impure: events, reactive logic, I/O
├─────────────────────────────────────┤
│        Presentation Layer           │  Impure: GUI, CLI, API endpoints
└─────────────────────────────────────┘
```

**Key rule**: The pure layer (domain model, business logic) declares behavior. The impure layer (application, interoperability, presentation) interprets and executes it. Dependencies point inward — outer layers depend on inner layers, never the reverse.

### The Pure/Impure Split

Every functional application has two fundamental layers:

- **Pure layer**: deterministic code that declares behavior without evaluating it impurely. Contains domain models, business logic, eDSLs, validation rules, transformation pipelines
- **Impure layer**: code that interacts with the outside world — I/O, network, databases, clocks, randomness. Should be as thin as possible

Design strategy: push as much logic as possible into the pure layer. The impure layer should be a thin shell that interprets pure declarations.

## Functional Interface Patterns (Dependency Inversion)

These patterns are the functional equivalent of OOP dependency injection. They separate the "what" (interface) from the "how" (implementation).

### 1. Service Handle Pattern

**What**: A record/object containing functions that implement a service's interface. Different records for production, testing, etc.

**How it works**: Define a data type (record/struct) whose fields are functions. Create different instances for different environments. Pass the handle as an argument to business logic.

**Pros**: Simple, explicit, easy to understand, great testability via handle swapping
**Cons**: Can become verbose with many services; manual wiring

**When to use**: Most pragmatic choice for Kotlin/TypeScript. Start here unless you have specific needs that require more powerful patterns.

### 2. ReaderT / Reader Pattern

**What**: Thread a shared environment (containing service handles) through computations implicitly using the Reader monad.

**How it works**: Define an environment type containing all service dependencies. Business logic runs in a Reader monad that has implicit access to the environment. At the application boundary, provide the concrete environment.

**Pros**: Clean dependency injection, no explicit parameter threading
**Cons**: All services available everywhere (less granular than type classes); monad transformer overhead in some languages

**When to use**: When you have many cross-cutting dependencies and want clean injection without passing handles everywhere.

### 3. Free Monad Pattern

**What**: Represent a program as a data structure (AST) that can be interpreted in different ways.

**How it works**:
1. Define a "language" as an ADT (the operations your program can perform)
2. Wrap this ADT in the Free monad to get monadic composition for free
3. Write programs using the language — they produce AST values, not effects
4. Write interpreters that traverse the AST and produce actual effects

**The key insight**: Decoupling computation from interpretation. The same program can be interpreted for production (real I/O), testing (mock responses), logging (trace execution), or analysis (inspect the program structure).

**Hierarchical Free Monads (HFM)**: Granin's novel pattern — compose multiple eDSLs hierarchically. A higher-level language embeds calls to lower-level languages, creating a layered DSL architecture.

**Pros**: Maximum testability, full program introspection, clean separation of concerns
**Cons**: Performance overhead, steep learning curve, boilerplate, harder to debug

**When to use**: Complex domain logic that benefits from introspection; when you need to mock at the operation level; when building a framework.

### 4. Final Tagless / mtl

**What**: Abstract over the effect type using type classes / interfaces. Business logic is polymorphic in the monad it runs in.

**How it works**: Define capabilities as type classes (e.g., `MonadDatabase`, `MonadLogger`). Business logic requires these capabilities but doesn't know the concrete monad. At the application boundary, provide a concrete monad that satisfies all required capabilities.

**Pros**: Composable, type-safe, no runtime interpretation overhead
**Cons**: Complex type signatures, "n-squared" problem with many effects, requires advanced type system features

**When to use**: Haskell/Scala codebases where the team is comfortable with advanced types.

### 5. Effect Systems

**What**: Modern approach that provides a structured way to declare and handle effects (ZIO in Scala, Arrow/KIO in Kotlin, Polysemy in Haskell).

**How it works**: Effects are declared in the type signature. Handlers provide implementations for effects. Effects compose naturally.

**Pros**: Ergonomic, composable, good error handling, structured concurrency
**Cons**: Library-specific, learning curve, may conflict with existing patterns

**When to use**: Greenfield projects in ecosystems with mature effect libraries. Arrow for Kotlin, fp-ts/Effect for TypeScript.

### Comparison Summary

| Criterion | Service Handle | ReaderT | Free Monad | Final Tagless | Effect Systems |
|---|---|---|---|---|---|
| **Simplicity** | High | Medium | Low | Low | Medium |
| **Testability** | High | High | Very High | High | High |
| **Performance** | Best | Good | Overhead | Good | Good |
| **Boilerplate** | Medium | Low | High | Medium | Low |
| **Team Learning** | Low | Medium | High | High | Medium |
| **Ecosystem** | Universal | FP-heavy | Haskell/Scala | Haskell/Scala | Growing |

**Default recommendation**: Start with Service Handle. Graduate to ReaderT or Effect Systems when the pain of manual wiring exceeds the complexity of the pattern.

## Domain Modeling

### Algebraic Data Types (ADTs)

ADTs are the fundamental building block of functional domain modeling:

- **Sum types** (tagged unions / sealed hierarchies): represent choices — "this OR that"
- **Product types** (records / data classes): represent combinations — "this AND that"
- **Parameterized types**: generic over contained types — `List<A>`, `Result<E, A>`
- **Recursive types**: types that reference themselves — trees, lists, ASTs

Design heuristic: if your domain has a finite set of alternatives, use a sum type. If it has a bundle of properties, use a product type. If it has both, compose them.

### Embedded Domain-Specific Languages (eDSLs)

An eDSL is a mini-language embedded in your host language that models the operations of a specific domain.

**Everything is an eDSL**: any well-designed API is effectively an eDSL. The difference is intentionality — when you consciously design an eDSL, you get:

1. **Domain-specific naming** that non-programmers can read
2. **Restricted operations** — users can only do valid things
3. **Composability** — eDSL operations compose naturally
4. **Interpretation flexibility** — the same eDSL program can be run, tested, analyzed, or optimized differently

**Design approach**:
1. Identify the domain's core operations
2. Model operations as constructors of a sum type (the "language")
3. Build smart constructors that return eDSL values
4. Write interpreters for different contexts (production, test, debug)

**Domain-specific vs. domain-centric**:

- **Domain-centric languages (DCLs)** are rigid, direct, literal translations of domain concepts. They encode domain notions naively without composability or orthogonality. Simple but don't scale with requirements. Example: `InitSolidFuelBoosters`, `DecoupleSolidFuelBoosters` — each action is a direct, non-composable command.
- **Domain-specific languages (DSLs)** capture the *essence* and *structure* of the domain — they are composable, orthogonal, and reveal the domain's mathematical properties. Example: generic `SetupController`, `RegisterComponent` operations that compose to describe any device.
- Aim for domain-specific when the domain is well-understood. DCLs can evolve into DSLs as understanding deepens.

### The Continuation Pattern in eDSLs

The fundamental pattern that leads to free monads:

```
MethodName Param1 Param2 (ReturnType -> nextScript)
```

This pattern encodes two semantics simultaneously: **sequencing actions** and **returning values**. The continuation field `(ReturnType -> nextScript)` means:
1. The method produces a value of `ReturnType`
2. The next part of the script receives that value and can use it

This enables dependent operations (e.g., `SetupController` produces a `Controller` avatar that `RegisterComponent` requires). Invalid orderings become unrepresentable — you can't register a component before setting up a controller because you don't have the `Controller` value yet.

**Avatars**: Lightweight references to runtime instances. An avatar like `Controller` is just an index/pointer — it doesn't carry the real instance, just enough to identify it. The interpreter maps avatars to actual runtime objects.

### Mnemonic Analysis

A technique for discovering the best eDSL representation:

1. Take a domain scenario and write it in pseudocode
2. Try different representations: imperative (step-by-step), stream-based (continuous values), declarative (descriptions)
3. Each representation reveals different functional idioms: imperative suggests monadic eDSLs, stream-based suggests FRP, declarative suggests ADTs
4. Choose the representation that best captures the domain's essence while enabling the most functional patterns

### Modeling Multiple Interacting eDSLs

For complex systems, define separate eDSLs for separate concerns and compose them:

- **Horizontal composition**: eDSLs at the same abstraction level, communicating through shared domain types
- **Vertical composition (Hierarchical)**: higher-level eDSLs embed lower-level eDSLs. The top-level language orchestrates domain-specific sub-languages

**Avoiding cyclic dependencies**: When separate eDSLs need to reference each other (e.g., Hdl -> LogicControl -> Hdl), use **parameterized ADTs** to break the cycle. Make each language generic in the "next step" type:

```
data HdlMethod next = SetupController Name Passport (Controller -> next)
data DeviceControlMethod next = ReadSensor Controller Index (Measurement -> next)
data LogicControlMethod next = EvalHdl (HdlMethod next) | EvalDeviceControl (DeviceControlMethod next) | Report Message
```

The type parameter `next` decouples the languages from each other — none needs to know the concrete type of another.

## State Management

### Approaches (in order of increasing complexity)

1. **Stateless / pure transformations**: No state at all — functions take input, produce output. Ideal when possible.

2. **Argument-passing state**: Thread state explicitly through function parameters. Simple, explicit, but verbose with deep call chains.

3. **State monad**: Encapsulate state threading in a monad. Clean syntax, composable, but adds monadic context.

4. **STM (Software Transactional Memory)**: For concurrent state. Transactions that compose — retry and rollback are automatic. Far simpler than locks/mutexes.

5. **Contained mutable state**: Wrap mutable references behind a pure interface. Last resort but sometimes necessary for performance.

**Design rule**: Use the simplest approach that satisfies your requirements. Don't reach for STM when argument-passing suffices.

### Purity and State Relationship

| | Pure Layer | Impure Layer |
|---|---|---|
| **Pure state** | Allowed | Allowed |
| **Impure state** | Disallowed | Allowed |

Pure state (argument-passing, State monad) lives in the pure layer. Impure state (IORef, TVar, mutable references) only exists in the impure layer. Free monadic eDSLs can wrap impure state operations into a pure interface — the eDSL methods like `newVar`, `readVar`, `writeVar` are pure (they produce AST values), but their interpreters are impure.

### Typed-Untyped Design Pattern

For managing heterogeneous state (many variables of different types) behind a unified interface:

1. Define a **typed wrapper** (`StateVar<A>`) that carries a type-safe identifier
2. Store actual values in an **untyped map** (`Map<VarId, Any>`) internally
3. The typed wrapper ensures type safety at the API boundary; the untyped map enables dynamic storage
4. Optionally attach debug/tracing capabilities (print functions, creation timestamps) to the typed wrapper

This pattern bridges the gap between type-safe APIs and dynamic runtime storage needs.

### Structured Logging as eDSL

Design logging as a pure eDSL that is interpreted impurely:
- Define log levels, message formats, and structured data as ADTs
- Business logic calls pure logging functions that produce log entries as values
- The interpreter decides where and how to output them (console, file, service)
- This keeps logging from polluting your pure domain logic

## Error Handling

### Error Domains

Errors should be modeled as ADTs, organized by architectural layer:

- **Domain errors**: validation failures, business rule violations — modeled as sum types in the domain layer
- **Infrastructure errors**: database failures, network errors — modeled separately, handled at the interoperability layer
- **Application errors**: configuration errors, initialization failures — handled at the application layer

### Principles

1. **Errors are values**, not exceptions — use `Result<E, A>` / `Either<E, A>`
2. **Typed error channels** — the error type is part of the function signature
3. **Fail fast** with descriptive context at the point of detection
4. **Transform errors** at layer boundaries — don't leak infrastructure errors into the domain
5. **Never silently swallow errors**
6. Exceptions are reserved for truly exceptional, unrecoverable situations (out of memory, assertion violations)

## Testing Strategy

### By Layer

| Layer | Test Type | Approach |
|---|---|---|
| **Domain Model** | Unit tests | Pure functions — test extensively with property-based tests |
| **Business Logic (pure)** | Unit tests | Test eDSL programs by interpreting with mock interpreters |
| **Business Logic (impure)** | Integration tests | Test with real (managed) dependencies, mock unmanaged ones |
| **Services** | Integration tests | Swap service handles for test doubles |
| **Application** | Acceptance tests | End-to-end through the full stack |

### Testable Architecture

The FDD architecture is inherently testable because:

1. **Pure domain logic** is trivially testable — no mocks needed, just call functions
2. **Service Handle pattern** enables easy handle swapping for tests
3. **Free Monad programs** can be interpreted by test interpreters that validate the sequence of operations
4. **eDSLs** separate what the program does from how it does it — test both independently

### Mocking Strategy

- **Pure code**: No mocking needed — test directly
- **Service handles**: Create test handles with canned responses. Add mutable counters (IORef/AtomicInteger) to track invocation counts.
- **Free monads**: Write test interpreters that return predetermined values. Can also record the sequence of operations for **white-box testing** — verify not just outputs but the exact sequence of eDSL commands executed.
- **External dependencies**: Only mock at the system boundary (the "unmanaged dependency" rule from Khorikov)

### White-Box Testing with Free Monads

Free monadic programs are ASTs that can be inspected. A test interpreter can:
1. Record every eDSL operation that was called (and with what arguments)
2. Return canned responses for each operation
3. After interpretation, assert on the recorded sequence

This enables testing the *logic flow* — verifying that the right operations happen in the right order — without needing real infrastructure. Use sparingly: over-constraining the operation sequence makes tests brittle.

### Property-Based Testing

Pure domain logic is ideal for property-based testing:
- Generate random domain values
- Assert invariants that should always hold (e.g., "area is always positive", "parsing then serializing returns the original")
- Use pre-conditions to filter invalid inputs
- Particularly powerful for eDSL interpreters — generate random scripts and verify invariants of interpretation

### End-to-End Design Validation

A critical practice: write tests that exercise the full path through your architecture early, even with fake implementations. This validates:
- Interfaces fit together correctly
- No critical design flaws exist in the architecture
- Types and data flow work end-to-end
- Fakes can be replaced incrementally with real implementations

**Principle**: "Design against shapes, not content. Fake the content until it's truly required."

## Concurrency Patterns

### Actor Model

Individual components with their own threads and state, communicating via messages. Each actor:
- Has private state
- Processes messages sequentially
- Can send messages to other actors
- Can create new actors

### STM (Software Transactional Memory)

Composable concurrent state management:
- Define transactional variables
- Compose transactions with monadic operations
- Runtime handles retries and rollbacks automatically
- No deadlocks, no manual lock management

### MVar Request-Response Pattern

A pattern for synchronous communication between concurrent components:
1. Caller creates an empty MVar (a thread-safe, single-element container)
2. Caller sends request containing the MVar to the responder
3. Responder fills the MVar with the response
4. Caller blocks on the MVar until the response arrives

## Persistence Patterns

### Type-Safe Key-Value Database

Use the type system to make database operations type-safe:

1. Define a **database tag type** (e.g., `AstroDB`) that identifies the database
2. Define **entity tag types** for each entity stored in the database
3. Use associated types / type families to connect each entity to its key and value types
4. The database interface functions are parameterized by these types — the compiler enforces that you use the right key type for the right entity

### Higher-Kinded Data (HKD) Pattern

For relational database models where the same data structure needs different representations (with/without primary key, with/without optional fields):

1. Define the data type with a type parameter that wraps each field: `data User f = User { name :: f String, email :: f String }`
2. `User Identity` gives you plain fields (`String`)
3. `User Maybe` gives you optional fields for partial updates
4. `User (Const PrimaryKey)` gives you key references
5. This avoids duplicating near-identical data types for insert vs. select vs. update operations

### Decoupling SQL from Business Logic

- Define abstract database operations as an eDSL (or service handle)
- The eDSL knows about domain types but not SQL
- The interpreter/implementation translates domain operations to SQL
- **Warning from the book**: High coupling between SQL connectors and domain models is one of the most common sources of accidental complexity. Keep them strictly separated.

## The Bracket Pattern (Resource Management)

Functional equivalent of RAII:
1. **Acquire** the resource
2. **Use** the resource (in a function that receives it)
3. **Release** the resource (guaranteed, even on error)

The bracket function ensures cleanup happens regardless of success or failure — no resource leaks.

## Design Process Summary

1. **Collect requirements** using mind maps, user scenarios, Q&A
2. **Identify essential complexity** — what cannot be simplified
3. **Design the domain model** as ADTs — this is the pure core
4. **Design eDSLs** for each subsystem's operations
5. **Choose functional interface patterns** for dependency inversion
6. **Layer the architecture** — pure core, impure shell
7. **Design state management** — use the simplest approach that works
8. **Design error handling** — typed errors, transformed at boundaries
9. **Plan testing** — pure logic gets unit tests, orchestration gets integration tests
10. **Implement top-down** — types first, then interfaces, then implementations
