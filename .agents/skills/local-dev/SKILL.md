---
name: local-dev
description: >
  Set up or tear down the local development environment for the sales-order-orchestrator project.
  Use when the user asks to "set up local dev", "local dev setup", "tear down local dev", or
  "local dev teardown".
argument-hint: "[setup|teardown]"
---

# Local Dev Environment

## 0. Check project context

If the current working directory is **not** the `sales-order-orchestrator` project, stop and ask
the user what they want to do — this skill was written specifically for that project and the steps
below may not apply elsewhere. Do not proceed without confirmation.

## 1. Determine action

- If `$ARGUMENTS` is `setup` or `teardown`, use that.
- Otherwise, ask the user: **"Do you want to set up or tear down the local dev environment?"**

---

## Setup

The goal is a fully local E2E environment for the flow:
`shipping notice → sales order → OPO creation`

Architecture:
```
curl → DevController → ShippingNoticeEventListener → SalesOrderService → DB
                               ↓
                       PurchaseOrderClient → WireMock (localhost:8089)

curl → DevController → OpoCreationService → StockClient → WireMock
                             ↓
                   OperationalOrderClient → WireMock
                             ↓
                          DB (opo_code)

curl → DevController → StockGlobalStateChangeEventListener → InboundItemService → DB (NEW_GOODS_RECEIVE)
                                    ↓
                             OutboundItemService → OwnershipTransferClient → WireMock (RELOCATION)
                                    ↓
                                 DB (position_item, transferred_quantity)
```

### Step 1 — Create `docker-compose.yaml` in the project root

```yaml
services:
  postgres:
    image: postgres:17
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: sales_order
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data

  wiremock:
    image: wiremock/wiremock:3.12.0
    ports:
      - "8089:8080"
    command: ["--global-response-templating"]
    volumes:
      - ./wiremock:/home/wiremock

volumes:
  postgres-data:
```

### Step 2 — Create WireMock mapping files

Create directory `wiremock/mappings/` and add the following files:

#### `wiremock/mappings/po-PO2156983C.json`
```json
{
  "priority": 1,
  "request": { "method": "GET", "urlPath": "/purchase-orders/PO2156983C" },
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "jsonBody": {
      "code": "PO2156983C",
      "purchase_order_positions": [
        { "simple_sku": "EV421G07I-A1100XS000", "price_after_discount": { "amount": 29.99, "currency": "EUR" } },
        { "simple_sku": "EV421G07I-A11000S000", "price_after_discount": { "amount": 29.99, "currency": "EUR" } },
        { "simple_sku": "EV421G07I-A11000M000", "price_after_discount": { "amount": 29.99, "currency": "EUR" } }
      ]
    }
  }
}
```

#### `wiremock/mappings/po-PO2143883C.json`
```json
{
  "priority": 1,
  "request": { "method": "GET", "urlPath": "/purchase-orders/PO2143883C" },
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "jsonBody": {
      "code": "PO2143883C",
      "purchase_order_positions": [
        { "simple_sku": "EV421D2Y2-A1100XS000", "price_after_discount": { "amount": 44.50, "currency": "EUR" } },
        { "simple_sku": "EV421D2Y2-A11000S000", "price_after_discount": { "amount": 44.50, "currency": "EUR" } }
      ]
    }
  }
}
```

#### `wiremock/mappings/po-PO2143922C.json`
```json
{
  "priority": 1,
  "request": { "method": "GET", "urlPath": "/purchase-orders/PO2143922C" },
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "jsonBody": {
      "code": "PO2143922C",
      "purchase_order_positions": [
        { "simple_sku": "YO121029K-Q1100XS000", "price_after_discount": { "amount": 18.75, "currency": "EUR" } },
        { "simple_sku": "YO121029K-Q11000S000", "price_after_discount": { "amount": 18.75, "currency": "EUR" } },
        { "simple_sku": "YO121029K-Q11000M000", "price_after_discount": { "amount": 18.75, "currency": "EUR" } }
      ]
    }
  }
}
```

#### `wiremock/mappings/po-catchall.json`
```json
{
  "priority": 10,
  "request": { "method": "GET", "urlPathPattern": "/purchase-orders/.*" },
  "response": {
    "status": 404,
    "headers": { "Content-Type": "application/json" },
    "jsonBody": { "error": "Purchase order not found" }
  }
}
```

#### `wiremock/mappings/stock-location-BER2.json`
```json
{
  "priority": 1,
  "request": {
    "method": "GET",
    "urlPath": "/stock-locations",
    "queryParameters": { "warehouse_code": { "equalTo": "BER2" } }
  },
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "jsonBody": {
      "stock_locations": [
        {
          "stock_location_id": "a1f23e45-6b78-4c9d-0e12-f34567890abc",
          "warehouse_code": "BER2",
          "name": "Berlin Warehouse 2",
          "fulfillment_type": "ZALANDO"
        }
      ]
    }
  }
}
```

#### `wiremock/mappings/stock-location-ABOUT-YOU-WAREHOUSE.json`
```json
{
  "priority": 1,
  "request": {
    "method": "GET",
    "urlPath": "/stock-locations",
    "queryParameters": { "warehouse_code": { "equalTo": "ABOUT_YOU_WAREHOUSE" } }
  },
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "jsonBody": {
      "stock_locations": [
        {
          "stock_location_id": "b2c34d56-7e89-4f0a-1b23-c45678901def",
          "warehouse_code": "ABOUT_YOU_WAREHOUSE",
          "name": "About You Fulfillment Center",
          "fulfillment_type": "PARTNER"
        }
      ]
    }
  }
}
```

#### `wiremock/mappings/stock-location-catchall.json`
```json
{
  "priority": 10,
  "request": { "method": "GET", "urlPath": "/stock-locations" },
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "jsonBody": { "stock_locations": [] }
  }
}
```

#### `wiremock/mappings/opo-prepare-order.json`
```json
{
  "priority": 1,
  "request": { "method": "POST", "urlPath": "/orders" },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json",
      "Location": "http://localhost:8089/orders/{{randomValue type='UUID'}}"
    },
    "transformers": ["response-template"]
  }
}
```

#### `wiremock/mappings/opo-place-order.json`
```json
{
  "priority": 1,
  "request": { "method": "PUT", "urlPathPattern": "/orders/[^/]+/with-response" },
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "body": "{\"id\": \"{{request.pathSegments.[1]}}\"}\n",
    "transformers": ["response-template"]
  }
}
```

### Step 3 — Create `src/main/kotlin/org/zalando/app/dev/DevController.kt`

```kotlin
package org.zalando.app.dev

import org.springframework.context.annotation.Profile
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.zalando.app.events.consumption.Cause
import org.zalando.app.events.consumption.ExternalReference
import org.zalando.app.events.consumption.GlobalMovementReason
import org.zalando.app.events.consumption.GlobalStateChange
import org.zalando.app.events.consumption.ItemState
import org.zalando.app.events.consumption.ReferenceType
import org.zalando.app.events.consumption.ShippingNoticeData
import org.zalando.app.events.consumption.ShippingNoticeEvent
import org.zalando.app.events.consumption.ShippingNoticePositionData
import org.zalando.app.events.consumption.StateChange
import org.zalando.app.opo.OpoCreationService
import org.zalando.app.salesorder.closing.SalesOrderClosingService
import org.zalando.app.subscription.STOCK_GLOBAL_STATE_CHANGE_EVENT
import org.zalando.app.subscription.SHIPPING_NOTICE_EVENT_COMPACTED
import org.zalando.app.subscription.ShippingNoticeEventListener
import org.zalando.app.subscription.StockGlobalStateChangeEventListener
import org.zalando.app.utils.logger
import org.zalando.fahrschein.domain.DataOperation
import org.zalando.fahrschein.domain.Metadata
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

private val log = logger()

@RestController
@Profile("local")
@RequestMapping("/dev")
class DevController(
    private val shippingNoticeListener: ShippingNoticeEventListener,
    private val gscListener: StockGlobalStateChangeEventListener,
    private val opoCreationService: OpoCreationService,
    private val closingService: SalesOrderClosingService,
) {

    @PostMapping("/trigger-shipping-notice")
    fun triggerShippingNotice(@RequestBody request: TriggerShippingNoticeRequest): ResponseEntity<String> {
        val event = request.toEvent()
        log.info { "Triggering shipping notice event for SN=${request.number}" }
        return try {
            shippingNoticeListener.listen(event)
            ResponseEntity.ok("Event processed successfully for SN=${request.number}")
        } catch (ex: Exception) {
            log.error(ex) { "Failed to process shipping notice event for SN=${request.number}" }
            ResponseEntity.internalServerError().body("Error: ${ex.message}")
        }
    }

    @PostMapping("/trigger-gsc-event")
    fun triggerGscEvent(@RequestBody request: TriggerGscEventRequest): ResponseEntity<String> {
        val event = request.toEvent()
        log.info { "Triggering GSC event: itemId=${request.itemId} reason=${request.movementReason}" }
        return try {
            gscListener.listen(event)
            ResponseEntity.ok("GSC event processed for item=${request.itemId} (${request.movementReason})")
        } catch (ex: Exception) {
            log.error(ex) { "Failed to process GSC event for item=${request.itemId}" }
            ResponseEntity.internalServerError().body("Error: ${ex.message}")
        }
    }

    @PostMapping("/trigger-so-closing")
    fun triggerSoClosing(): ResponseEntity<String> {
        log.info { "Triggering SO closing" }
        return try {
            closingService.closeReadyOrders()
            ResponseEntity.ok("SO closing completed")
        } catch (ex: Exception) {
            log.error(ex) { "Failed to run SO closing" }
            ResponseEntity.internalServerError().body("Error: ${ex.message}")
        }
    }

    @PostMapping("/trigger-opo-creation")
    fun triggerOpoCreation(
        @RequestParam("delivery_date") deliveryDate: LocalDate?,
    ): ResponseEntity<String> {
        val date = deliveryDate ?: LocalDate.now().plusDays(1)
        log.info { "Triggering OPO creation for deliveryDate=$date" }
        return try {
            val hadFailures = opoCreationService.createOposForDeliveryDate(date)
            if (hadFailures) {
                ResponseEntity.ok("OPO creation completed with some failures for deliveryDate=$date")
            } else {
                ResponseEntity.ok("OPO creation completed successfully for deliveryDate=$date")
            }
        } catch (ex: Exception) {
            log.error(ex) { "Failed OPO creation for deliveryDate=$date" }
            ResponseEntity.internalServerError().body("Error: ${ex.message}")
        }
    }
}

data class TriggerShippingNoticeRequest(
    val number: String,
    val businessUnitCode: String = "ABOUT_YOU",
    val status: String = "SCHEDULED",
    val scheduledDeliveryDate: LocalDate = LocalDate.now().plusDays(7),
    val scheduledWarehouseCode: String = "BER2",
    val positions: List<TriggerShippingNoticePosition> = emptyList(),
) {
    fun toEvent(): ShippingNoticeEvent = ShippingNoticeEvent(
        metadata = Metadata(
            SHIPPING_NOTICE_EVENT_COMPACTED,
            UUID.randomUUID().toString(),
            OffsetDateTime.now(),
            "0",
            "1.0",
            "dev-controller",
            OffsetDateTime.now(),
            UUID.randomUUID().toString(),
        ),
        dataOp = DataOperation.CREATE,
        data = ShippingNoticeData(
            number = number,
            businessUnitCode = businessUnitCode,
            status = status,
            scheduledDeliveryDate = scheduledDeliveryDate,
            scheduledWarehouseCode = scheduledWarehouseCode,
            positions = positions.map { it.toPositionData() },
        ),
    )
}

data class TriggerShippingNoticePosition(
    val purchaseOrderNumber: String,
    val simpleSku: String,
    val quantity: Int = 10,
) {
    fun toPositionData(): ShippingNoticePositionData = ShippingNoticePositionData(
        purchaseOrderNumber = purchaseOrderNumber,
        simpleSku = simpleSku,
        quantity = quantity,
    )
}

data class TriggerGscEventRequest(
    val itemId: UUID = UUID.randomUUID(),
    val movementReason: GlobalMovementReason,
    val productId: String,
    val qualityLabel: String? = null,
    val itemQuality: String? = null,
    val references: List<TriggerGscReference> = emptyList(),
) {
    fun toEvent(): GlobalStateChange = GlobalStateChange(
        itemId = itemId,
        references = references.map { ExternalReference(it.type, it.reference) },
        cause = Cause(movementReason),
        data = StateChange.Update(
            newItemState = ItemState(
                productId = productId,
                qualityLabel = qualityLabel,
                itemQuality = itemQuality,
            ),
        ),
        metadata = Metadata(
            STOCK_GLOBAL_STATE_CHANGE_EVENT,
            UUID.randomUUID().toString(),
            OffsetDateTime.now(),
            "0",
            "1.0",
            "dev-controller",
            OffsetDateTime.now(),
            UUID.randomUUID().toString(),
        ),
    )
}

data class TriggerGscReference(val type: ReferenceType, val reference: String)
```

### Step 4 — Modify `src/main/kotlin/org/zalando/app/config/EventListenerConfig.kt`

Add `@ConditionalOnProperty` to `SubscriptionsStarter`:

1. Add import: `import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty`
2. Change `@Component` on `SubscriptionsStarter` to:
   ```kotlin
   @Component
   @ConditionalOnProperty(name = ["nakadi.subscriptions.enabled"], havingValue = "true", matchIfMissing = true)
   ```

### Step 5 — Modify `src/main/kotlin/org/zalando/app/config/NakadiConfig.kt`

Add local profile exclusion and local dummy token provider:

1. Change `@Profile("!test")` on `accessTokenProvider` to `@Profile("!test & !local")`
2. Add after that bean (inside the class, before closing `}`):
   ```kotlin
   @Bean
   @Profile("local")
   fun localAccessTokenProvider(): AccessTokenProvider = AccessTokenProvider { "local-dummy-token" }
   ```

### Step 6 — Replace `src/main/resources/config/application-local.yaml`

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/sales_order
    username: postgres
    password: postgres

nakadi:
  subscriptions:
    enabled: false

db-scheduler:
  enabled: false

riptide:
  defaults:
    auth:
      enabled: false
  clients:
    purchase-order-management:
      base-url: http://localhost:8089
      telemetry:
        enabled: false
    fulfilment-operational-order:
      base-url: http://localhost:8089
      telemetry:
        enabled: false
    stock:
      base-url: http://localhost:8089
      telemetry:
        enabled: false

opo:
  creation:
    enabled: true

logging:
  level:
    org.zalando.app: DEBUG
```

### Step 7 — Modify `build.gradle`

In the `kover > reports > filters > excludes` block, add after `classes("org.zalando.app.events.*")`:
```groovy
classes("org.zalando.app.dev.*")
```

### Step 8 — Modify `.gitignore`

Append at the end:
```
### Docker ###
docker-compose.override.yaml
```

### Step 8b — Check for missing WireMock stubs

Before starting, scan the codebase for HTTP client calls that may not have stubs yet.

1. Find all Riptide client beans in `src/main/kotlin` and collect their configured base-URLs from
   `application-local.yaml` (or any profile config). Clients pointing to `localhost:8089` need
   WireMock coverage.
2. For each such client, grep its usage files for HTTP method calls (`.get(`, `.post(`, `.put(`,
   `.delete(`, `.patch(`) and extract the URL path templates.
3. Compare the discovered paths against the mappings already present in `wiremock/mappings/`.
4. For every path that has **no** corresponding mapping file:
   - Ask the user what the expected response should be, or propose a sensible stub (e.g. 200 with
     a minimal body, or 404 catch-all) and confirm before creating it.
   - Create the mapping file.
5. **After adding any new stubs, update this skill file** (`~/.agents/skills/local-dev/SKILL.md`)
   to include those new mapping files in Step 2, so the next setup run includes them automatically.
   Do not leave the skill out of date.

### Step 9 — Start the environment

```bash
docker compose up -d
SPRING_PROFILES_ACTIVE=local ./gradlew bootRun
```

### Available WireMock stubs

| PO Code     | SKUs                                                               | Price  |
|-------------|--------------------------------------------------------------------|--------|
| PO2156983C  | EV421G07I-A1100XS000, EV421G07I-A11000S000, EV421G07I-A11000M000  | 29.99  |
| PO2143883C  | EV421D2Y2-A1100XS000, EV421D2Y2-A11000S000                        | 44.50  |
| PO2143922C  | YO121029K-Q1100XS000, YO121029K-Q11000S000, YO121029K-Q11000M000  | 18.75  |
| (any other) | → 404 Not Found                                                    |        |

| Warehouse Code      | Stock Location ID                         |
|---------------------|-------------------------------------------|
| BER2                | a1f23e45-6b78-4c9d-0e12-f34567890abc      |
| ABOUT_YOU_WAREHOUSE | b2c34d56-7e89-4f0a-1b23-c45678901def      |
| (any other)         | → empty list                              |

---

## Teardown

### Step 1 — Stop Docker

```bash
docker compose down
```

### Step 2 — Revert modified files

```bash
git checkout -- \
  src/main/kotlin/org/zalando/app/config/EventListenerConfig.kt \
  src/main/kotlin/org/zalando/app/config/NakadiConfig.kt \
  src/main/resources/config/application-local.yaml \
  build.gradle \
  .gitignore
```

### Step 3 — Remove created files

```bash
rm -rf docker-compose.yaml wiremock/ src/main/kotlin/org/zalando/app/dev/
```

---

## Usage after setup

### Trigger a shipping notice

```bash
curl -X POST http://localhost:8080/dev/trigger-shipping-notice \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "SN-TEST-001",
    "business_unit_code": "ABOUT_YOU",
    "status": "SCHEDULED",
    "scheduled_delivery_date": "2026-03-28",
    "scheduled_warehouse_code": "BER2",
    "positions": [
      { "purchase_order_number": "PO2156983C", "simple_sku": "EV421G07I-A1100XS000", "quantity": 10 },
      { "purchase_order_number": "PO2156983C", "simple_sku": "EV421G07I-A11000S000", "quantity": 5 }
    ]
  }'
```

### Trigger a stock global-state-change event (inbound — NEW_GOODS_RECEIVE)

```bash
curl -X POST http://localhost:8080/dev/trigger-gsc-event \
  -H 'Content-Type: application/json' \
  -d '{
    "item_id": "00000000-0000-0000-0000-000000000001",
    "movement_reason": "NEW_GOODS_RECEIVE",
    "product_id": "EV421G07I-A1100XS000",
    "references": [
      { "type": "RESERVATION_ID", "reference": "<opo-code-from-db>" }
    ]
  }'
```

### Trigger a stock global-state-change event (outbound — RELOCATION)

```bash
curl -X POST http://localhost:8080/dev/trigger-gsc-event \
  -H 'Content-Type: application/json' \
  -d '{
    "item_id": "00000000-0000-0000-0000-000000000001",
    "movement_reason": "RELOCATION",
    "product_id": "EV421G07I-A1100XS000",
    "quality_label": "0002RC0A84D",
    "item_quality": "A"
  }'
```

### Trigger SO closing

```bash
curl -X POST http://localhost:8080/dev/trigger-so-closing
```

### Trigger OPO creation

```bash
curl -X POST "http://localhost:8080/dev/trigger-opo-creation?delivery_date=2026-03-28"
```

### Verify in database

```bash
docker exec -it sales-order-orchestrator-postgres-1 psql -U postgres -d sales_order \
  -c "SELECT id, status, opo_code, scheduled_delivery_date FROM soo.sales_order;" \
  -c "SELECT * FROM soo.position_item;"
```

### Check WireMock request log

```bash
curl -s http://localhost:8089/__admin/requests | python3 -m json.tool
```
