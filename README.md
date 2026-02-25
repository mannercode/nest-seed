# nest-msa

NestJS 기반 마이크로서비스 아키텍처 템플릿. 영화 예매 도메인을 예제로 삼아 MSA의 다양한 개념과 기술을 검증한다.

## Documentation

- [Domain Glossary](docs/glossary.md) — 도메인 용어 정의
- [Entity Design](docs/designs/entities.md) — 엔터티 속성, 관계, ER 다이어그램

## Key Concepts

### Service Decomposition

4개 서비스(Gateway, Applications, Cores, Infrastructures)를 역할 기반으로 분리한다. 각 서비스는 겹치지 않는 책임을 갖기 때문에 독립적으로 변경·배포할 수 있다.

### Dependency Layering

모노레포 안에서 서비스 간 순환 의존이 생기면 변경 영향이 양방향으로 전파되어 레이어의 의미가 사라진다. ESLint `no-restricted-imports`로 의존 방향을 단방향으로 강제하여 이를 방지한다.

### Inter-Service Communication

서비스 간 통신에 NATS를 사용한다. HTTP 호출과 달리 서비스 디스커버리 없이 클러스터 내 모든 노드가 메시지를 라우팅하며, 동기 호출(RPC)과 비동기 알림(이벤트)을 하나의 브로커로 처리한다.

### API Gateway

인증, 요청 검증, 로깅 같은 횡단 관심사를 Gateway 한 곳에서 처리한다. 내부 서비스는 이런 관심사를 알 필요 없이 비즈니스 로직에만 집중할 수 있다.

### Async Job Processing

상영 일정 일괄 생성처럼 오래 걸리는 작업은 BullMQ 큐에 넣고 즉시 응답한다. 작업 실패 시 자동 재시도되며, 진행 상태를 이벤트로 클라이언트에 전달한다.

### Event-Driven Architecture

티켓 구매 같은 이벤트는 RPC 대신 pub-sub으로 발행한다. 발행자는 구독자의 존재를 모르므로 느슨하게 결합되며, 구독자를 추가해도 발행 측 코드를 수정할 필요가 없다.

### Repository Pattern

Mongoose 쿼리를 공통 리포지토리로 추상화하여 서비스마다 같은 방식으로 데이터에 접근한다. 에러 처리, 페이지네이션, 트랜잭션 로직이 한 곳에 집중되므로 중복이 줄고 일관성이 유지된다.

### Client-Service Parity

각 서비스에 동일한 시그니처의 Client 래퍼를 두어 원격 RPC 호출을 로컬 메서드처럼 사용한다. 호출하는 쪽에서는 통신 프로토콜을 의식하지 않으며, 타입 안전성도 유지된다.

### Clustered Infrastructure

MongoDB 레플리카셋, Redis 클러스터, NATS 클러스터를 로컬 환경에서도 구성하여 프로덕션과 동일한 토폴로지에서 개발·테스트한다. 단일 노드에서는 발견되지 않는 클러스터 동기화, 페일오버 관련 문제를 사전에 검증할 수 있다.

### Health Check

각 서비스가 HTTP 헬스체크 엔드포인트를 제공하고 Docker 헬스체크와 연동한다. 컨테이너 오케스트레이터가 이를 통해 서비스 상태를 감지하고 비정상 컨테이너를 자동 재시작한다.

### Testing Strategy

Testcontainers로 실제 MongoDB, NATS 컨테이너를 띄워 테스트한다. Mock 대신 실제 인프라를 사용하므로 트랜잭션, 인덱스, TTL 같은 동작을 그대로 검증할 수 있다. E2E 테스트는 전체 서비스 스택을 Docker Compose로 실행하여 HTTP API 단위로 시나리오를 검증한다.

## Tech Stack

| Category           | Technology                 |
| ------------------ | -------------------------- |
| **Framework**      | NestJS 11                  |
| **Language**       | TypeScript 5               |
| **Database**       | MongoDB (Mongoose)         |
| **Cache / Queue**  | Redis (BullMQ)             |
| **Messaging**      | NATS                       |
| **Object Storage** | MinIO (S3-compatible)      |
| **Auth**           | JWT + Passport             |
| **Testing**        | Jest + Testcontainers      |
| **Build**          | Webpack                    |
| **Container**      | Docker (multi-stage build) |

## Architecture

```
Client ── HTTP ──▶ Gateway ── NATS RPC ──┬──▶ Applications  (비즈니스 로직, 비동기 작업)
                                         ├──▶ Cores          (도메인 모델, 데이터 영속성)
                                         └──▶ Infrastructures (외부 서비스 연동)
```

### Dependency Layering

모노레포 안에 4개 서비스가 공존하기 때문에, 의도치 않게 역방향 의존이 생기기 쉽다. 순환 의존이 발생하면 변경 영향이 양방향으로 전파되어 레이어 간 책임 경계가 무너진다. 이를 방지하기 위해 ESLint `no-restricted-imports` 규칙으로 의존 방향을 단방향으로 강제한다.

```
Gateway          ← 최상위: 모든 레이어에 의존 가능
  ↓
Applications     ← Gateway에 의존 불가
  ↓
Cores            ← Gateway, Applications에 의존 불가
  ↓
Infrastructures  ← Gateway, Applications, Cores에 의존 불가

shared / common  ← 어떤 앱 레이어에도 의존 불가
```

### Services

| Service             | Role                                    | Domains                                                                                       |
| ------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Gateway**         | API 진입점, 인증(JWT/Local)             | Customers, Movies, Theaters, Booking, Purchase, ShowtimeCreation                              |
| **Applications**    | 비즈니스 오케스트레이션, BullMQ 작업 큐 | ShowtimeCreation, Booking, Purchase, Recommendation                                           |
| **Cores**           | 핵심 도메인 엔터티, 데이터 영속성       | Customers, Movies, Theaters, Showtimes, Tickets, TicketHolding, PurchaseRecords, WatchRecords |
| **Infrastructures** | 외부 서비스 통합                        | Payments, Assets(MinIO)                                                                       |

### Infrastructure

| Component   | Configuration                                     |
| ----------- | ------------------------------------------------- |
| **MongoDB** | 3-node replica set (27017-27019)                  |
| **Redis**   | 6-node cluster, 3 primary + 3 replica (6379-6384) |
| **NATS**    | 3-node cluster (4222-4224)                        |
| **MinIO**   | S3-compatible object storage (9000, console 9001) |

## Project Structure

```
src/
├── apps/
│   ├── gateway/          # HTTP API 컨트롤러, 인증
│   ├── applications/     # 비즈니스 로직 서비스 (BullMQ)
│   ├── cores/            # 도메인 모델, 리포지토리
│   ├── infrastructures/  # 외부 서비스 연동 (결제, 파일)
│   ├── shared/           # 공통 설정, 비즈니스 규칙(Rules), 파이프, 미들웨어
│   └── __tests__/        # 단위/통합 테스트
├── libs/
│   ├── common/           # 공통 라이브러리 (로깅, DB, RPC, 캐시)
│   └── testlib/          # 테스트 유틸리티
├── tests/e2e/            # E2E 테스트 스펙
└── infra/local/          # 로컬 인프라 Docker Compose
```

## Getting Started

### Prerequisites

- Node.js 24+
- Docker & Docker Compose

### 1. Start Infrastructure

```bash
npm run infra:up
npm run infra:wait
```

관리 콘솔 및 모니터링 대시보드(mongo-express, RedisInsight, Grafana)와 함께 실행하려면:

```bash
npm run infra:gui
```

### 2. Start Application Services

```bash
npm run apps:up
npm run apps:wait
```

Gateway가 `http://localhost:3000`에서 요청을 수신한다.

### 3. Health Check

```bash
curl http://localhost:3000/health
```

## Scripts

| Script                | Description                                                 |
| --------------------- | ----------------------------------------------------------- |
| `npm run build`       | 특정 앱 빌드 (`TARGET_APP=gateway npm run build`)           |
| `npm run start`       | 빌드된 앱 실행 (`TARGET_APP=gateway npm run start`)         |
| `npm run debug`       | Watch 모드로 개발 실행 (`TARGET_APP=gateway npm run debug`) |
| `npm test`            | 단위 테스트 실행 (coverage 포함)                            |
| `npm run test:e2e`    | E2E 테스트 실행 (인프라 + 앱 자동 재시작)                   |
| `npm run lint`        | TypeScript 타입 체크, ESLint, Prettier 검사                 |
| `npm run format`      | ESLint 자동 수정 및 Prettier 포맷팅                         |
| `npm run infra:reset` | 인프라 초기화 (down + up + wait)                            |
| `npm run apps:reset`  | 앱 서비스 초기화 (down + up + wait)                         |

## Testing

### Unit Tests

[Testcontainers](https://testcontainers.com/)를 사용하여 MongoDB와 NATS를 실제 컨테이너로 띄워 테스트한다.

```bash
npm test

# 특정 서비스만 테스트
TEST_ROOT=src/apps/__tests__/cores npm test
```

### E2E Tests

전체 인프라와 앱을 Docker Compose로 실행한 후 HTTP API를 통해 시나리오를 검증한다.

```bash
npm run test:e2e
```
