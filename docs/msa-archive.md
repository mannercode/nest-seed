# MSA 구현 아카이브

본 repo 는 한때 **mono 와 msa 두 가지 구현**을 동일 도메인(영화관 예매)에 대해 유지했다. 2026-04-29 기준 msa 를 제거했다. 이 문서는 **무엇이 있었는지·왜 있었는지·왜 제거했는지** 를 기록한다. 다시 필요해질 때 이 문서와 git history (`apis/msa` 가 마지막으로 살아있던 commit) 를 출발점으로 재구성 가능.

> **2026-05-03 update — MSA-ready monolith 로 재포지셔닝.**
> msa 구현 자체는 archive 상태로 유지하되, msa 에서 사용하던 **NATS / Temporal 인프라는 mono 로 다시 도입**했다. 동기는 4 replica 기본 배포에서 cross-replica 메시징 (Redis Pub/Sub `PubSubService`) 과 saga 직접 구현 (BullMQ + 수동 compensate) 의 한계가 누적된 것. 코드는 단일 `apps/api` 그대로 두되 인프라만 MSA 수준으로 끌어올려, 코드를 여러 프로젝트로 나누지 않고도 같은 분산 표면을 사용한다. 추후 진정한 MSA 분리가 필요해지면 코드 경계만 끊으면 되고 인프라 교체 비용은 들지 않는다. 자세한 현행 사용은 [architecture.md](architecture.md) §5 참조.

## 제거 결정 (2026-04-29)

### 결정의 종합적 배경

**msa 는 그 자체가 목적이 아니라 mono 의 설계를 다듬기 위한 거울이었다.** msa 를 운영하면서 얻은 건 분산 전환 그 자체보다 **"같은 도메인을 진정한 서비스 경계로 나눠보면 mono 에서도 무엇을 폴더/모듈 단위로 격리하고 유지해야 하는지"** 가 명확해진 점이다. cores / applications / infrastructures 의 3-layer, ticket-holding 같은 경계 짓기, saga 의 compensation 패턴 — 이런 인식은 mono 에 그대로 남아 폴더 구조와 모듈 import 그래프에 반영되어 있다. msa 의 역할은 거기서 사실상 끝났다.

그 위에 다음 판단들이 겹쳐 제거 결정에 도달:

1. **mono 로도 어지간한 규모의 서비스는 감당 가능**하다는 점이 perf 튜닝 사이클에서 충분히 확인됨 (8 replica + nginx + mongo 3-node + redis 3-node 로 read 1996 RPS / write 2305 RPS / mixed 워크로드 ~2300 RPS, 본 [docs/perf/](perf/) 참조). 이 규모를 넘는 트래픽이 1차 목표인 시점이 아니라면 msa 의 운영 복잡도 비용은 정당화되지 않음.
2. **msa 가 다루던 핵심 motive 는 "인적 capacity 의 한계"** — 팀 간 경계를 명확히 해 여러 팀이 같은 codebase 를 만질 때 충돌·인지부하를 줄이는 것. 본 repo 는 (a) 소수 인원·단일 소유 운영이라 팀 경계 자체가 motive 가 안 되고, (b) AI 시대로 1인이 감당 가능한 mono 코드량의 상한이 올라가 "code 가 너무 커서 사람이 못 따라간다" 임계점도 뒤로 밀림. 두 조건이 변할 때 (팀이 커지거나 코드량이 1인 capacity 를 넘을 때) 다시 분리하면 충분.

### 직접 측정한 유지 비용

- 매 mono 변경마다 msa 포팅 — 이번 perf 사이클에서 실측: **10 파일 / 82 줄 추가** (commit `e093502`), 그리고 msa 전용 인덱스/lean 매핑 누락으로 인해 CI 실패 → 별도 fix commit (`67f1457`) 필요.
- Test Stability matrix 에 `unit (apis/msa)`, `bootup (msa, 70)` 가 더해져 **CI compute 약 +50 %** (~9h → ~14h).
- devcontainer infra 에 temporal + temporal-postgresql + nats3 가 상주 → `reset.sh` 시 docker pull 부담 ↑, 메모리 압박 가능성 ↑ (postStartCommand 직렬화 fix 의 한 동기).

## 무엇이 있었나 — 1줄 요약

`apis/msa` 는 mono 와 동일한 도메인을 **3개의 NestJS application** (cores / applications / infrastructures) 으로 쪼개 NATS RPC 와 Temporal workflow 위에서 통신·orchestration 하는 구현. **Kong** 게이트웨이 뒤에 위치.

## 아키텍처 비교 (mono vs msa)

| 축                    | mono                                                     | msa                                                             |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| Process 모델          | 단일 NestJS app × N replica                              | 3 NestJS app (cores/applications/infrastructures) × 각 replica  |
| Gateway               | nginx                                                    | Kong (declarative `kong.yml`)                                   |
| Inter-service 통신    | 같은 process 의 in-memory 호출                           | NATS RPC (`@nestjs/microservices` + custom queue-group)         |
| Long-running workflow | BullMQ + Redis pubsub event-stream                       | **Temporal** workflow + activities                              |
| 인증                  | controllers/guards/ 단일 위치                            | cores 가 guard 정의 → 다른 app 이 import 후 자체 적용           |
| 트랜잭션 경계         | mongo session 으로 한 process 안에서 묶임                | 분산 saga (Temporal 의 compensation activities)                 |
| Deploy compose        | `apps/api/deploy/compose.yml`                            | `apis/msa/deploy/compose.yml` + `apis/msa/deploy/kong/kong.yml` |
| Test 종류             | unit + spec(deploy 통합) + bootup repeat + race scenario | 동일 set 을 msa 용으로 별도                                     |

## 폴더 구조 비교 (핵심만)

### mono — 단일 app, 도메인을 폴더로 분리

```
apps/api/src/
├── controllers/                     # HTTP 진입점 + guards (모든 도메인 공용)
│   ├── booking.http-controller.ts
│   ├── customers.http-controller.ts
│   └── guards/
│       ├── customer-jwt-auth.guard.ts
│       ├── customer-local-auth.guard.ts
│       └── customer-optional-jwt-auth.guard.ts
├── applications/services/           # 도메인 서비스 (cross-aggregate)
│   ├── booking/
│   ├── purchase/
│   ├── recommendation/
│   └── showtime-creation/
├── cores/services/                  # 단일 aggregate CRUD
│   ├── customers/
│   ├── movies/
│   ├── showtimes/
│   ├── theaters/
│   ├── ticket-holding/
│   ├── tickets/
│   └── watch-records/
├── infrastructures/services/        # 외부 의존 (S3, payments)
│   ├── assets/
│   └── payments/
└── config/
```

### msa — 3 app, 각 app 이 자기 도메인의 HTTP/RPC 진입점 보유

```
apis/msa/src/
├── apps/
│   ├── cores/                       # 1차 도메인 (CRUD + customer auth guard)
│   │   ├── services/
│   │   │   ├── customers/
│   │   │   │   ├── customers.http-controller.ts   # 외부 HTTP
│   │   │   │   ├── customers.controller.ts        # NATS RPC (다른 app 이 호출)
│   │   │   │   └── guards/                        # mono 의 controllers/guards 와 동일 코드
│   │   │   ├── movies/
│   │   │   └── ...
│   │   ├── modules/
│   │   ├── main.ts                  # NestJS bootstrap (cores HTTP + RPC microservice)
│   │   └── development.ts
│   ├── applications/                # cross-aggregate 서비스 + Temporal workflow
│   │   ├── services/
│   │   │   ├── purchase/
│   │   │   │   ├── activities/      # Temporal activities (DB / external 호출 단위)
│   │   │   │   ├── workflows/       # Temporal workflow (orchestration)
│   │   │   │   └── ...
│   │   │   └── ...
│   │   ├── workflows.ts             # Temporal workflow registry (bundling 진입점)
│   │   └── main.ts
│   └── infrastructures/             # S3, payments (외부 의존 격리)
│       ├── services/{assets,payments}
│       └── main.ts
└── config/                          # 모든 app 이 import 하는 공통 설정
```

핵심 차이점:

- **mono 의 `src/applications/services/{purchase,...}` 는 같은 process 안에서 다른 service 를 직접 호출**
- **msa 의 `apps/applications/services/{purchase,...}` 는 NATS RPC 로 cores 의 service 를 호출**, 그리고 long-running 부분은 Temporal workflow 로 외부화

## libs 측 영향

msa 만 사용하던 라이브러리 워크스페이스도 함께 제거됨:

- `libs/microservices/` — `@mannercode/microservices`
    - `rpc/client-proxy.service.ts` — NATS RPC client wrapper (HttpException 포워딩, queue-group 로깅 등)
    - `rpc/queue-group.ts` — NATS queue-group decorator
    - `temporal/temporal-client.module.ts`, `temporal/temporal-worker.service.ts` — Temporal client/worker NestJS 통합
    - `logger/rpc-success-logger.interceptor.ts`, `logger/rpc-exception-logger.filter.ts` — RPC 전용 로거
- `libs/testing-microservices/` — `@mannercode/testing-microservices`
    - msa 통합 테스트 헬퍼 (Temporal in-memory testing, NATS testcontainers)
- `libs/tsconfig.json` 의 `paths` 에서 위 두 별칭 제거
- `libs/common/src/logger/exception-logger.filter.ts` 의 주석에서 `@mannercode/microservices` 참조 정리

## 기술 선택 메모 (msa 가 보여주던 것)

| 영역              | mono 선택                             | msa 선택                            | 이유/메모                                                                                                          |
| ----------------- | ------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Event-stream      | Redis pubsub + custom SSE bridge      | NATS pub/sub                        | NATS 가 msa 의 RPC 와 같은 transport 라 단순                                                                       |
| Long-running 작업 | BullMQ (Redis)                        | Temporal                            | Temporal 이 saga/compensation 모델·관측·재시도 면에서 우수, but 운영 surface 큼                                    |
| Service 경계      | 단일 process, 모듈로 분리             | NestJS application 단위             | 진정한 isolation vs 운영 단순성의 trade-off                                                                        |
| Gateway plugin    | nginx (gzip, keepalive 등 제한적 set) | Kong (rate-limit, JWT, ACL 등 풍부) | Kong 의 plugin 생태계가 정책 enforcement 에 유리 — [docs/plans/kong-migration.md](plans/kong-migration.md) 도 참고 |

## 운영·CI 측 영향

제거 시 다음 매트릭스가 단순화됨:

- `.github/workflows/test-stability.yaml` 의 `unit` matrix: `[libs, apps/api, apis/msa]` → `[libs, apps/api]`
- `.github/workflows/test-stability.yaml` 의 `bootup` matrix: `[mono, msa]` → `[mono]`
- `.devcontainer/infra/reset.sh` 의 두 번째 `compose up` (msa-infra: temporal + nats) 제거
- devcontainer 메모리/디스크 압박 완화 (temporal + postgres + nats3 컨테이너 4개 제거)

## 다시 필요할 때 — 복원 가이드

1. msa 가 마지막으로 살아있던 commit 을 git log 에서 찾는다 (이 문서 추가 직전 commit).
2. `git checkout <hash> -- apis/msa libs/microservices libs/testing-microservices .devcontainer/infra/msa` 로 파일 복원.
3. 다음 파일들에 msa 관련 항목 재추가:
    - `libs/tsconfig.json` paths
    - `.devcontainer/infra/reset.sh` 의 msa compose up
    - `.github/workflows/*.yaml` 의 msa matrix
    - `.vscode/tasks.json` 의 msa task
    - `README.md`, `docs/architecture.md`, `docs/development.md`
4. `npm install` 후 `npm run atoz -w apis/msa` 로 검증.

복원 후 mono 와의 도메인 코드 sync 비용은 다시 발생함을 감안.

## 학습으로 남는 것

- **모듈 경계의 명확화**: msa 가 한 일 중 가장 큰 것은 mono 의 **무엇을 격리·유지해야 하는지** 를 드러낸 것. cores / applications / infrastructures 3-layer, ticket-holding 의 분리, saga compensation 의 모양 — 이 인식은 mono 폴더·모듈 그래프에 그대로 살아있다. msa 의 코드는 사라져도 **이 분리 감각은 mono 에 영구적**.
- **분산 시스템의 실제 비용**: 2 구현 동시 유지가 코드량보다 **인지·운영 surface** 측면에서 큰 부담.
- **NATS RPC + Temporal** 의 공존 가능성 — 같은 도메인을 두 transport 로 운영해 본 결과, 단순 RPC 는 NATS, orchestration 은 Temporal 이 자연스러운 분담.
- **Kong 의 declarative `kong.yml`** 은 작은 지정만으로 routing 을 표현 가능하지만, plugin 활용을 시작하면 곧 외부 의존 (DB or postgres-less mode) 결정이 따라옴.
- **테스트 stability**: race scenario (`apps/api/tests/runner.sh customer-race` 등) 는 msa 환경에서도 동일하게 의미 있었으나, msa 전용 race 는 따로 만들지 않았음 — 즉 msa 의 검증은 unit + spec 수준에서 그쳤다는 점이 archive 시 공유.
