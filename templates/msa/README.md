# nest-msa

NestJS 기반 마이크로서비스 아키텍처 템플릿. 영화 예매 도메인을 예제로 삼아 MSA의 다양한 개념과 기술을 검증한다.

## Documentation

- [Conventions](CONVENTIONS.md) — 네이밍 규칙, 에러 패턴, 테스트 컨벤션
- [Design Guide](docs/design-guide.md) — 시스템 아키텍처, 설계 원칙
- [Domain Glossary](docs/glossary.md) — 도메인 용어 정의
- [Entity Design](docs/designs/entities.md) — 엔터티 속성, 관계, ER 다이어그램
- [Showtime Creation](docs/designs/showtime-creation.md) — 상영시간 생성 흐름
- [Ticket Purchase](docs/designs/tickets-purchase.md) — 티켓 구매 흐름
- [Decisions](docs/decisions.md) — 기술 선택 근거
- [Development Setup](docs/development.md) — 환경 파일, Dev Container, VS Code 설정

## Tech Stack

| Category           | Technology                 |
| ------------------ | -------------------------- |
| **Framework**      | NestJS 11                  |
| **Language**       | TypeScript 5               |
| **Database**       | MongoDB (Mongoose)         |
| **Cache**          | Redis                      |
| **Messaging**      | NATS                       |
| **Workflow**       | Temporal                   |
| **Object Storage** | MinIO (S3-compatible)      |
| **Auth**           | JWT + Passport             |
| **Testing**        | Jest                       |
| **Build**          | Webpack                    |
| **Container**      | Docker (multi-stage build) |

## Getting Started

### Prerequisites

- Node.js 24+
- Docker & Docker Compose

### 1. Install Dependencies

```bash
npm ci
```

### 2. Start Infrastructure

```bash
npm run infra:reset
```

관리 콘솔 및 모니터링 대시보드(mongo-express, RedisInsight, Grafana)와 함께 실행하려면:

```bash
npm run infra:gui
```

### 3. Run Tests

```bash
npm test
```

## Scripts

| Script                | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `npm run build`       | 특정 앱 빌드 (`TARGET_APP=gateway npm run build`)                 |
| `npm run start`       | 빌드된 앱 실행 (`TARGET_APP=gateway npm run start`)               |
| `npm run dev`         | Watch 모드로 개발 실행 (`TARGET_APP=gateway npm run dev`)         |
| `npm test`            | 전체 테스트 실행 (단위 + E2E)                                     |
| `npm run test:unit`   | 단위 테스트 실행 (coverage 포함)                                  |
| `npm run test:e2e`    | E2E 테스트 실행 (인프라 + 앱 자동 재시작)                         |
| `npm run lint`        | TypeScript 타입 체크, ESLint, Prettier 검사                       |
| `npm run format`      | ESLint 자동 수정 및 Prettier 포맷팅                               |
| `npm run infra:reset` | 인프라 초기화 (down + up + wait)                                  |
| `npm run infra:gui`   | 관리 콘솔 포함 인프라 실행 (mongo-express, RedisInsight, Grafana) |
| `npm run apps:reset`  | 앱 서비스 초기화 (down + up + wait)                               |

## Testing

### Unit Tests

Docker Compose로 실행한 인프라(MongoDB, NATS, Redis, MinIO, Temporal)를 사용하여 테스트한다.

```bash
npm run test:unit
```

### E2E Tests

전체 인프라와 앱을 Docker Compose로 실행한 후 HTTP API를 통해 시나리오를 검증한다. `curl`과 `jq`가 필요하다.

```bash
npm run test:e2e
```

## Project Structure

```
src/
├── config/               # 앱 설정, 비즈니스 규칙(Rules), 파이프, 미들웨어
├── apps/
│   ├── gateway/          # HTTP API 컨트롤러, 인증
│   ├── applications/     # 비즈니스 로직 서비스 (Temporal Workflow)
│   ├── cores/            # 도메인 모델, 리포지토리
│   ├── infrastructures/  # 외부 서비스 연동 (결제, 파일)
│   └── __tests__/        # 단위/통합 테스트
tests/e2e/                # E2E 테스트 스펙
infra/local/              # 로컬 인프라 Docker Compose
```

## Key Concepts

### Service Decomposition

4개 서비스(Gateway, Applications, Cores, Infrastructures)를 역할 기반으로 분리한다. 각 서비스는 겹치지 않는 책임을 갖기 때문에 독립적으로 변경·배포할 수 있다.

### Dependency Layering

모노레포 안에서 서비스 간 순환 의존이 생기면 변경 영향이 양방향으로 전파되어 레이어의 의미가 사라진다. ESLint `no-restricted-imports`로 의존 방향을 단방향으로 강제하여 이를 방지한다.

### Inter-Service Communication

서비스 간 통신에 NATS를 사용한다. HTTP 호출과 달리 서비스 디스커버리 없이 클러스터 내 모든 노드가 메시지를 라우팅하며, 동기 호출(RPC)과 비동기 알림(이벤트)을 하나의 브로커로 처리한다.

### API Gateway

인증, 요청 검증, 로깅 같은 횡단 관심사를 Gateway 한 곳에서 처리한다. 내부 서비스는 이런 관심사를 알 필요 없이 비즈니스 로직에만 집중할 수 있다.

### Workflow Orchestration

티켓 구매의 Saga 보상 패턴, 상영 일정 일괄 생성처럼 여러 서비스에 걸쳐 실행되는 흐름을 Temporal 워크플로우로 오케스트레이션한다. 워크플로우는 실패 시 자동 재시도되며, 보상 로직이 코드에 명시적으로 표현되어 장애 복구가 안정적이다.

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

Docker Compose로 실행한 실제 인프라(MongoDB, NATS, Redis, MinIO, Temporal)를 사용하여 테스트한다. Mock 대신 실제 인프라를 사용하므로 트랜잭션, 인덱스, TTL, 워크플로우 실행 같은 동작을 그대로 검증할 수 있다. E2E 테스트는 전체 서비스 스택을 Docker Compose로 실행하여 HTTP API 단위로 시나리오를 검증한다.
