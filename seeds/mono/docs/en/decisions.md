> **English** | [한국어](../ko/decisions.md)

# Design Decision Records

Documents the major technical and design decisions made in the project along with their rationale.

---

## 1. Message Broker: NATS

> This decision applies to the microservice-based [nest-msa](https://github.com/mannercode/nest-msa) project. The current monolithic architecture does not use NATS.

### Decision

Use **NATS** as the inter-service messaging layer.

### Rationale

After evaluating multiple message brokers supported by NestJS, NATS was determined to be the most suitable.

- Actively developed and maintained.
- JetStream has the potential to replace Kafka when building logging systems.
- Easy to scale performance.
- Lightweight, making it easy to set up not only for production but also for development environments.

### Alternatives Considered

**Why Kafka was excluded**

- **kafkajs performance issues**: Serious problems occur when configuring `maxWaitTimeInMs`. kafkajs runs an infinite loop to continuously check for messages, sleeping for `maxWaitTimeInMs` when none are found. This means Jest tests must wait at least `maxWaitTimeInMs` before terminating. Even simple tests incur this minimum delay. The infinite loop structure itself is detrimental to performance. Moreover, kafkajs appears to have been abandoned since 2022.
- **Topic creation issues during testing**: When initializing Kafka containers for testing, topics must be pre-created. For example, defining a `getCustomer` message requires two topics: `getCustomer` and `getCustomer.reply`. Creating a single topic takes several seconds, so wait times grow significantly as the number of topics increases. This is especially problematic in nest-msa, which reinitializes infrastructure for each full test run.
- **High memory usage**: A minimum configuration of 3 brokers + 3 controllers is needed, with each container using approximately 1GB. While not a major issue in production, this is burdensome for local development environments.

**Why other brokers were excluded**

- **MQTT**: Optimized for resource-constrained environments like IoT devices, but may lack performance for large-scale systems.
- **RabbitMQ**: Complex to configure and manage, particularly for clustering and high availability (HA).

---

## 2. Workflow Orchestration: Temporal

> This decision applies to the microservice-based [nest-msa](https://github.com/mannercode/nest-msa) project. The current monolithic architecture uses BullMQ.

### Decision

Use **Temporal** for distributed transactions (Saga) and async task processing.

### Rationale

A reliable means was needed to manage flows spanning multiple services, such as the Saga compensation pattern for ticket purchases and batch showtime creation.

- **Explicit compensation logic**: Temporal workflows have compensation stacks written directly in code, making flows easier to understand than manual try/catch Sagas.
- **Automatic retry and durability**: Temporal automatically retries failed Activities, and workflow state is persisted to the server, allowing execution to resume even after process restarts.
- **Testability**: `@temporalio/testing` provides an in-process test server, enabling workflow verification without separate Docker containers.
- **Active ecosystem**: Temporal is actively developed and maintained, providing SDKs for multiple languages.

### Alternatives Considered

**Why BullMQ was replaced**

- BullMQ is a simple task queue that requires manual implementation of the Saga compensation pattern. Developers must manage compensation order and idempotency manually on failure, increasing complexity.
- When sequential multi-service call logic in a BullMQ Worker grows long, error handling branches multiply rapidly.
- Temporal's server manages workflow state, so if a Worker process dies, another Worker can continue execution. BullMQ only supports task-level retries.

---
