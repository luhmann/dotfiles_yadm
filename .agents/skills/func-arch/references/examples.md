# Language-Specific Examples — Kotlin & TypeScript

Concrete implementations of FDD patterns in Kotlin and TypeScript. These are reference examples — adapt naming, structure, and style to match the user's existing codebase conventions.

---

## 1. Algebraic Data Types (Domain Modeling)

### Kotlin

```kotlin
// Sum type via sealed interface
sealed interface Shape {
    data class Circle(val radius: Double) : Shape
    data class Rectangle(val width: Double, val height: Double) : Shape
    data class Triangle(val base: Double, val height: Double) : Shape
}

// Pure domain function — pattern matching via when
fun area(shape: Shape): Double = when (shape) {
    is Shape.Circle -> Math.PI * shape.radius * shape.radius
    is Shape.Rectangle -> shape.width * shape.height
    is Shape.Triangle -> 0.5 * shape.base * shape.height
}

// Nested ADT — domain model for a subsystem
sealed interface Command {
    data class StartEngine(val engineId: EngineId) : Command
    data class StopEngine(val engineId: EngineId) : Command
    data class SetThrottle(val engineId: EngineId, val level: Double) : Command
}

sealed interface CommandResult {
    data class Success(val command: Command) : CommandResult
    data class Failure(val command: Command, val reason: ErrorReason) : CommandResult
}

sealed interface ErrorReason {
    data class EngineNotFound(val engineId: EngineId) : ErrorReason
    data class AlreadyRunning(val engineId: EngineId) : ErrorReason
    data class InvalidThrottle(val level: Double) : ErrorReason
}
```

### TypeScript

```typescript
// Sum type via discriminated unions
type Shape =
    | { kind: "circle"; radius: number }
    | { kind: "rectangle"; width: number; height: number }
    | { kind: "triangle"; base: number; height: number };

// Pure domain function — exhaustive pattern matching
function area(shape: Shape): number {
    switch (shape.kind) {
        case "circle":
            return Math.PI * shape.radius ** 2;
        case "rectangle":
            return shape.width * shape.height;
        case "triangle":
            return 0.5 * shape.base * shape.height;
    }
}

// Nested ADT — domain model
type Command =
    | { kind: "startEngine"; engineId: string }
    | { kind: "stopEngine"; engineId: string }
    | { kind: "setThrottle"; engineId: string; level: number };

type CommandResult =
    | { kind: "success"; command: Command }
    | { kind: "failure"; command: Command; reason: ErrorReason };

type ErrorReason =
    | { kind: "engineNotFound"; engineId: string }
    | { kind: "alreadyRunning"; engineId: string }
    | { kind: "invalidThrottle"; level: number };
```

---

## 2. Service Handle Pattern (Dependency Inversion)

The most pragmatic FDD pattern. A "handle" is an object/record of functions — swap it for testing.

### Kotlin

```kotlin
// Define the service interface as a class of functions (the "handle")
class DatabaseHandle(
    val getUser: suspend (UserId) -> Result<User>,
    val saveUser: suspend (User) -> Result<Unit>,
    val deleteUser: suspend (UserId) -> Result<Unit>,
)

class LoggerHandle(
    val info: (String) -> Unit,
    val error: (String, Throwable?) -> Unit,
)

// Production handles
fun createProductionDatabase(pool: ConnectionPool): DatabaseHandle =
    DatabaseHandle(
        getUser = { id -> runCatching { pool.query("SELECT ...") } },
        saveUser = { user -> runCatching { pool.execute("INSERT ...") } },
        deleteUser = { id -> runCatching { pool.execute("DELETE ...") } },
    )

fun createProductionLogger(config: LogConfig): LoggerHandle =
    LoggerHandle(
        info = { msg -> println("[INFO] $msg") },
        error = { msg, ex -> System.err.println("[ERROR] $msg: ${ex?.message}") },
    )

// Business logic depends only on handles — pure w.r.t. dependencies
suspend fun registerUser(
    db: DatabaseHandle,
    logger: LoggerHandle,
    request: RegistrationRequest,
): Result<User> {
    logger.info("Registering user: ${request.email}")
    val user = User.fromRequest(request)  // pure domain logic
    return db.saveUser(user).map { user }
}

// Test handle — no real database needed
fun createTestDatabase(storage: MutableMap<UserId, User> = mutableMapOf()): DatabaseHandle =
    DatabaseHandle(
        getUser = { id -> storage[id]?.let { Result.success(it) }
            ?: Result.failure(NoSuchElementException("User $id not found")) },
        saveUser = { user -> storage[user.id] = user; Result.success(Unit) },
        deleteUser = { id -> storage.remove(id); Result.success(Unit) },
    )
```

### TypeScript

```typescript
// Service handle as an object type
type DatabaseHandle = {
    getUser: (id: string) => Promise<Result<User>>;
    saveUser: (user: User) => Promise<Result<void>>;
    deleteUser: (id: string) => Promise<Result<void>>;
};

type LoggerHandle = {
    info: (msg: string) => void;
    error: (msg: string, err?: Error) => void;
};

// Production handle
function createProductionDatabase(pool: Pool): DatabaseHandle {
    return {
        getUser: (id) => pool.query("SELECT ...").then(ok).catch(err),
        saveUser: (user) => pool.query("INSERT ...").then(ok).catch(err),
        deleteUser: (id) => pool.query("DELETE ...").then(ok).catch(err),
    };
}

// Business logic depends only on handles
async function registerUser(
    db: DatabaseHandle,
    logger: LoggerHandle,
    request: RegistrationRequest,
): Promise<Result<User>> {
    logger.info(`Registering user: ${request.email}`);
    const user = User.fromRequest(request); // pure domain logic
    const result = await db.saveUser(user);
    return result.map(() => user);
}

// Test handle
function createTestDatabase(
    storage: Map<string, User> = new Map(),
): DatabaseHandle {
    return {
        getUser: async (id) => {
            const user = storage.get(id);
            return user ? ok(user) : err(new Error(`User ${id} not found`));
        },
        saveUser: async (user) => {
            storage.set(user.id, user);
            return ok(undefined);
        },
        deleteUser: async (id) => {
            storage.delete(id);
            return ok(undefined);
        },
    };
}
```

---

## 3. eDSL Pattern (Embedded Domain-Specific Languages)

Model domain operations as data, then interpret.

### Kotlin

```kotlin
// The eDSL: a sealed hierarchy representing hardware operations
sealed interface HardwareOp<out A> {
    data class ReadSensor(val sensorId: SensorId) : HardwareOp<SensorReading>
    data class WriteActuator(val actuatorId: ActuatorId, val value: Double) : HardwareOp<Unit>
    data class GetStatus(val deviceId: DeviceId) : HardwareOp<DeviceStatus>
}

// A "program" is a list of operations — simple sequential eDSL
data class HardwareProgram<A>(val steps: List<HardwareOp<*>>, val result: () -> A)

// Smart constructors — the API users interact with
fun readSensor(id: SensorId): HardwareOp<SensorReading> = HardwareOp.ReadSensor(id)
fun writeActuator(id: ActuatorId, value: Double): HardwareOp<Unit> = HardwareOp.WriteActuator(id, value)

// Interpreter: production
suspend fun interpret(op: HardwareOp<*>, driver: HardwareDriver): Any = when (op) {
    is HardwareOp.ReadSensor -> driver.read(op.sensorId)
    is HardwareOp.WriteActuator -> driver.write(op.actuatorId, op.value)
    is HardwareOp.GetStatus -> driver.status(op.deviceId)
}

// Interpreter: test — returns canned values
fun interpretTest(op: HardwareOp<*>, responses: Map<Any, Any>): Any = when (op) {
    is HardwareOp.ReadSensor -> responses[op.sensorId] ?: error("No test data for ${op.sensorId}")
    is HardwareOp.WriteActuator -> Unit
    is HardwareOp.GetStatus -> responses[op.deviceId] ?: DeviceStatus.UNKNOWN
}
```

### TypeScript

```typescript
// The eDSL: discriminated union of operations
type HardwareOp =
    | { kind: "readSensor"; sensorId: string }
    | { kind: "writeActuator"; actuatorId: string; value: number }
    | { kind: "getStatus"; deviceId: string };

// Smart constructors
const readSensor = (sensorId: string): HardwareOp => ({ kind: "readSensor", sensorId });
const writeActuator = (actuatorId: string, value: number): HardwareOp =>
    ({ kind: "writeActuator", actuatorId, value });

// Production interpreter
async function interpret(op: HardwareOp, driver: HardwareDriver): Promise<unknown> {
    switch (op.kind) {
        case "readSensor":
            return driver.read(op.sensorId);
        case "writeActuator":
            return driver.write(op.actuatorId, op.value);
        case "getStatus":
            return driver.status(op.deviceId);
    }
}

// Test interpreter
function interpretTest(op: HardwareOp, responses: Record<string, unknown>): unknown {
    switch (op.kind) {
        case "readSensor":
            return responses[op.sensorId] ?? (() => { throw new Error(`No test data`) })();
        case "writeActuator":
            return undefined;
        case "getStatus":
            return responses[op.deviceId] ?? "unknown";
    }
}
```

---

## 4. Reader Pattern (Dependency Injection)

Thread dependencies implicitly through computations.

### Kotlin (using Arrow)

```kotlin
import arrow.core.raise.Raise
import arrow.core.raise.either

// Environment containing all dependencies
data class AppEnv(
    val db: DatabaseHandle,
    val logger: LoggerHandle,
    val config: AppConfig,
)

// Business logic as extension functions on AppEnv (Reader-like)
// AppEnv acts as the implicit environment
suspend fun AppEnv.registerUser(request: RegistrationRequest): Result<User> {
    logger.info("Registering: ${request.email}")
    val validated = validateRequest(request)  // pure
    val user = User.fromValidated(validated)  // pure
    return db.saveUser(user).map { user }
}

suspend fun AppEnv.getUserProfile(userId: UserId): Result<UserProfile> {
    val user = db.getUser(userId).getOrThrow()
    return Result.success(UserProfile.fromUser(user, config.defaultAvatarUrl))
}

// Wiring at the application boundary
suspend fun main() {
    val env = AppEnv(
        db = createProductionDatabase(connectionPool),
        logger = createProductionLogger(logConfig),
        config = loadConfig(),
    )
    // All business logic runs "in" the environment
    env.registerUser(request)
}
```

### TypeScript

```typescript
// Environment type
type AppEnv = {
    db: DatabaseHandle;
    logger: LoggerHandle;
    config: AppConfig;
};

// Reader-style: functions that take env as first parameter
// (or use a closure / context pattern)
const registerUser =
    (env: AppEnv) =>
    async (request: RegistrationRequest): Promise<Result<User>> => {
        env.logger.info(`Registering: ${request.email}`);
        const validated = validateRequest(request); // pure
        const user = User.fromValidated(validated); // pure
        const result = await env.db.saveUser(user);
        return result.map(() => user);
    };

// Wiring at the boundary
const env: AppEnv = {
    db: createProductionDatabase(pool),
    logger: createProductionLogger(logConfig),
    config: loadConfig(),
};

// Run business logic with the environment
await registerUser(env)(request);

// Test: inject test environment
const testEnv: AppEnv = {
    db: createTestDatabase(),
    logger: { info: () => {}, error: () => {} },
    config: testConfig,
};
await registerUser(testEnv)(request);
```

---

## 5. Typed Error Handling

### Kotlin

```kotlin
// Error domain as sealed hierarchy
sealed interface RegistrationError {
    data class EmailAlreadyExists(val email: String) : RegistrationError
    data class InvalidEmail(val email: String, val reason: String) : RegistrationError
    data class WeakPassword(val requirements: List<String>) : RegistrationError
}

// Using Result-like types (Arrow's Either or custom)
typealias RegistrationResult<A> = Either<RegistrationError, A>

fun validateEmail(email: String): RegistrationResult<ValidEmail> =
    if (!email.contains("@")) RegistrationError.InvalidEmail(email, "missing @").left()
    else ValidEmail(email).right()

suspend fun register(
    db: DatabaseHandle,
    request: RegistrationRequest,
): RegistrationResult<User> = either {
    val validEmail = validateEmail(request.email).bind()
    val validPassword = validatePassword(request.password).bind()
    val user = User(validEmail, validPassword)
    db.saveUser(user).mapLeft { RegistrationError.EmailAlreadyExists(request.email) }.bind()
    user
}
```

### TypeScript

```typescript
// Error domain as discriminated union
type RegistrationError =
    | { kind: "emailAlreadyExists"; email: string }
    | { kind: "invalidEmail"; email: string; reason: string }
    | { kind: "weakPassword"; requirements: string[] };

// Simple Result type
type Result<E, A> = { ok: true; value: A } | { ok: false; error: E };

const ok = <A>(value: A): Result<never, A> => ({ ok: true, value });
const err = <E>(error: E): Result<E, never> => ({ ok: false, error });

function validateEmail(email: string): Result<RegistrationError, string> {
    if (!email.includes("@")) return err({ kind: "invalidEmail", email, reason: "missing @" });
    return ok(email);
}

async function register(
    db: DatabaseHandle,
    request: RegistrationRequest,
): Promise<Result<RegistrationError, User>> {
    const emailResult = validateEmail(request.email);
    if (!emailResult.ok) return emailResult;

    const passwordResult = validatePassword(request.password);
    if (!passwordResult.ok) return passwordResult;

    const user = createUser(emailResult.value, passwordResult.value);
    const saveResult = await db.saveUser(user);
    if (!saveResult.ok) return err({ kind: "emailAlreadyExists", email: request.email });

    return ok(user);
}
```

---

## 6. Pure/Impure Layer Split

### Kotlin

```kotlin
// ========== PURE LAYER (domain model + business logic) ==========

// Domain types
data class Temperature(val celsius: Double)
data class SensorReading(val sensorId: SensorId, val temperature: Temperature, val timestamp: Instant)

// Pure domain logic — no I/O, no side effects
fun isOverheating(reading: SensorReading, threshold: Temperature): Boolean =
    reading.temperature.celsius > threshold.celsius

fun averageTemperature(readings: List<SensorReading>): Temperature =
    Temperature(readings.map { it.temperature.celsius }.average())

fun detectAnomalies(readings: List<SensorReading>, threshold: Double): List<SensorReading> =
    readings.filter { reading ->
        val avg = averageTemperature(readings)
        kotlin.math.abs(reading.temperature.celsius - avg.celsius) > threshold
    }

// ========== IMPURE LAYER (thin shell) ==========

// Application wiring — the only place where effects happen
suspend fun monitorTemperatures(
    sensors: SensorHandle,
    alerts: AlertHandle,
    config: MonitorConfig,
) {
    val readings = config.sensorIds.map { sensors.read(it) }  // impure: I/O
    val anomalies = detectAnomalies(readings, config.anomalyThreshold)  // pure
    anomalies.forEach { alerts.send(it) }  // impure: I/O
}
```

### TypeScript

```typescript
// ========== PURE LAYER ==========

type Temperature = { celsius: number };
type SensorReading = { sensorId: string; temperature: Temperature; timestamp: number };

// Pure functions — testable without mocks
const isOverheating = (reading: SensorReading, threshold: Temperature): boolean =>
    reading.temperature.celsius > threshold.celsius;

const averageTemperature = (readings: SensorReading[]): Temperature => ({
    celsius: readings.reduce((sum, r) => sum + r.temperature.celsius, 0) / readings.length,
});

const detectAnomalies = (readings: SensorReading[], threshold: number): SensorReading[] => {
    const avg = averageTemperature(readings);
    return readings.filter(
        (r) => Math.abs(r.temperature.celsius - avg.celsius) > threshold,
    );
};

// ========== IMPURE LAYER (thin shell) ==========

async function monitorTemperatures(
    sensors: SensorHandle,
    alerts: AlertHandle,
    config: MonitorConfig,
): Promise<void> {
    const readings = await Promise.all(config.sensorIds.map((id) => sensors.read(id))); // impure
    const anomalies = detectAnomalies(readings, config.anomalyThreshold); // pure
    await Promise.all(anomalies.map((a) => alerts.send(a))); // impure
}
```

---

## 7. State Management — Contained Mutable State

### Kotlin

```kotlin
// State container with a pure query interface
class StateStore<S>(initial: S) {
    private val state = AtomicReference(initial)

    fun get(): S = state.get()

    // Pure transformation — the update function is pure, the mutation is contained
    fun update(transform: (S) -> S): S =
        state.updateAndGet(transform)

    // Pure query
    fun <A> query(selector: (S) -> A): A = selector(state.get())
}

// Usage: the state type is a pure data class
data class SimulatorState(
    val sensors: Map<SensorId, SensorReading>,
    val actuators: Map<ActuatorId, ActuatorState>,
    val tick: Long,
)

val store = StateStore(SimulatorState(emptyMap(), emptyMap(), 0))

// Pure state transformations
fun advanceTick(state: SimulatorState): SimulatorState =
    state.copy(tick = state.tick + 1)

fun updateSensor(id: SensorId, reading: SensorReading): (SimulatorState) -> SimulatorState =
    { state -> state.copy(sensors = state.sensors + (id to reading)) }

// Impure shell uses the contained state
store.update(advanceTick)
store.update(updateSensor(sensorId, newReading))
```

### TypeScript

```typescript
// Contained mutable state with pure interface
class StateStore<S> {
    private state: S;

    constructor(initial: S) {
        this.state = initial;
    }

    get(): S {
        return this.state;
    }

    // Pure transformation function, contained mutation
    update(transform: (state: S) => S): S {
        this.state = transform(this.state);
        return this.state;
    }

    query<A>(selector: (state: S) => A): A {
        return selector(this.state);
    }
}

// Pure state type
type SimulatorState = {
    sensors: Record<string, SensorReading>;
    actuators: Record<string, ActuatorState>;
    tick: number;
};

// Pure transformations
const advanceTick = (state: SimulatorState): SimulatorState => ({
    ...state,
    tick: state.tick + 1,
});

const updateSensor =
    (id: string, reading: SensorReading) =>
    (state: SimulatorState): SimulatorState => ({
        ...state,
        sensors: { ...state.sensors, [id]: reading },
    });
```

---

## 8. Continuation Pattern & Avatars in eDSLs

Make invalid operation orderings unrepresentable by using continuations.

### Kotlin

```kotlin
// Avatar — a lightweight reference to a runtime instance
@JvmInline
value class ControllerId(val id: String)

// eDSL with continuations: SetupController MUST be called before RegisterComponent
// because RegisterComponent requires a ControllerId that only SetupController produces
sealed interface HdlOp<out A> {
    // Sets up a controller and returns its avatar via continuation
    data class SetupController<A>(
        val deviceName: String,
        val controllerName: String,
        val passport: ComponentPassport,
        val next: (ControllerId) -> A,   // continuation: produces avatar for next step
    ) : HdlOp<A>

    // Requires a ControllerId — can only be called after SetupController
    data class RegisterComponent<A>(
        val controllerId: ControllerId,   // avatar from SetupController
        val componentIndex: String,
        val passport: ComponentPassport,
        val next: A,
    ) : HdlOp<A>

    // Read a sensor — requires both controller avatar and component index
    data class ReadSensor<A>(
        val controllerId: ControllerId,
        val componentIndex: String,
        val next: (Result<Measurement>) -> A,  // continuation returning measurement
    ) : HdlOp<A>
}

// Script is type-safe: can't register without setting up first
fun buildBoosterScript(): List<HdlOp<List<HdlOp<*>>>> = listOf(
    HdlOp.SetupController("left booster", "left-ctrl", aaa86Passport) { ctrl ->
        listOf(
            HdlOp.RegisterComponent(ctrl, "nozzle1-t", aaaT25Passport, Unit),
            HdlOp.RegisterComponent(ctrl, "nozzle1-p", aaaP02Passport, Unit),
            HdlOp.ReadSensor(ctrl, "nozzle1-t") { measurement ->
                listOf(HdlOp.RegisterComponent(ctrl, "extra", extraPassport, Unit))
            },
        )
    },
)
```

### TypeScript

```typescript
// Avatar — branded type for type safety
type ControllerId = string & { readonly __brand: "ControllerId" };

// eDSL with continuations
type HdlOp<A> =
    | {
          kind: "setupController";
          deviceName: string;
          controllerName: string;
          passport: ComponentPassport;
          next: (controllerId: ControllerId) => A; // continuation
      }
    | {
          kind: "registerComponent";
          controllerId: ControllerId; // requires avatar
          componentIndex: string;
          passport: ComponentPassport;
          next: A;
      }
    | {
          kind: "readSensor";
          controllerId: ControllerId;
          componentIndex: string;
          next: (result: Result<Measurement>) => A; // continuation
      };

// Script: type-safe ordering
function buildBoosterScript(): HdlOp<HdlOp<unknown>[]>[] {
    return [
        {
            kind: "setupController",
            deviceName: "left booster",
            controllerName: "left-ctrl",
            passport: aaa86Passport,
            next: (ctrl) => [
                // ctrl is available here because setupController produced it
                {
                    kind: "registerComponent",
                    controllerId: ctrl,
                    componentIndex: "nozzle1-t",
                    passport: aaaT25Passport,
                    next: undefined,
                },
            ],
        },
    ];
}
```

---

## 9. Smart Constructors & Opaque Types

### Kotlin

```kotlin
// The internal representation is hidden — only smart constructors are exposed
// In Kotlin, use a companion object with a private constructor

class Email private constructor(val value: String) {
    companion object {
        fun create(raw: String): Result<Email> =
            if (raw.contains("@") && raw.contains("."))
                Result.success(Email(raw.lowercase()))
            else
                Result.failure(IllegalArgumentException("Invalid email: $raw"))
    }

    override fun toString() = value
}

// Usage — impossible to construct an invalid Email
val email = Email.create("User@Example.COM") // Ok: Email("user@example.com")
val bad = Email.create("not-an-email")       // Failure
// Email("anything") — won't compile, constructor is private
```

### TypeScript

```typescript
// Branded type + smart constructor for opaque types
declare const __brand: unique symbol;
type Email = string & { readonly [__brand]: "Email" };

function createEmail(raw: string): Result<{ kind: "invalidEmail"; value: string }, Email> {
    if (raw.includes("@") && raw.includes(".")) {
        return ok(raw.toLowerCase() as Email);
    }
    return err({ kind: "invalidEmail", value: raw });
}

// Usage — impossible to use a raw string where Email is expected
function sendTo(email: Email): void { /* ... */ }
sendTo("raw@string"); // Type error!
sendTo(createEmail("valid@email.com").value); // Only via smart constructor
```

---

## 10. Bracket Pattern (Resource Management)

### Kotlin

```kotlin
// Generic bracket — acquire, use, release
suspend fun <R, A> bracket(
    acquire: suspend () -> R,
    release: suspend (R) -> Unit,
    use: suspend (R) -> A,
): A {
    val resource = acquire()
    return try {
        use(resource)
    } finally {
        release(resource)
    }
}

// Usage
suspend fun withDatabase(config: DbConfig, block: suspend (Database) -> Unit) {
    bracket(
        acquire = { Database.connect(config) },
        release = { db -> db.close() },
        use = block,
    )
}
```

### TypeScript

```typescript
// Generic bracket
async function bracket<R, A>(
    acquire: () => Promise<R>,
    release: (resource: R) => Promise<void>,
    use: (resource: R) => Promise<A>,
): Promise<A> {
    const resource = await acquire();
    try {
        return await use(resource);
    } finally {
        await release(resource);
    }
}

// Usage
async function withDatabase(config: DbConfig, block: (db: Database) => Promise<void>) {
    await bracket(
        () => Database.connect(config),
        (db) => db.close(),
        block,
    );
}
```
