# nest-seed

NestJS 모노레포 시드. 영화 예매 도메인을 예시로, **MSA-ready monolith** 구조 — 코드는 단일 `apps/api` 지만 4 replica 기본 배포 + NATS / Temporal 인프라를 유지한다.

## 시작하기

### 1. Dev Container

사전 요구: Docker, VS Code (Dev Containers 확장).

```bash
git clone <repository-url>
code nest-seed
```

VS Code에서 `Reopen in Container`. 컨테이너 시작 시 인프라(MongoDB RS · Redis Cluster · MinIO · NATS · Temporal)가 자동 기동된다. 인프라 초기화가 완료될 때까지 터미널 출력을 확인한 뒤 다음 단계.

> 호스트에서 [Git credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials)를 미리 설정한다.

최소 사양: CPU 4, RAM 16GB, Storage 32GB.

### 2. 빌드 → 테스트 → 실행

```bash
npm run build           # apps가 libs에 의존하므로 먼저 빌드
npm test                # 단위/통합 테스트
bash apps/api/deploy/test.sh   # Docker Compose로 빌드·기동 후 curl spec 검증
cd apps/api && npm run dev     # watch 모드 실행
curl http://localhost:3000/movies
```

### 3. 분산 race 테스트

4-replica docker compose 스택을 띄워 cross-replica race를 검증한다 — SSE 팬아웃, 동시 가입/홀드, saga 중첩, 중복 구매. `package.json`에는 노출하지 않고 shell로 직접 호출. 자세한 내용은 [docs/testing.md#5-분산-테스트-cross-replica-race](docs/testing.md#5-분산-테스트-cross-replica-race).

```bash
bash apps/api/tests/runner.sh <scenario>
# scenario: sse | user-race | ticket-holding-race | showtime-overlap-race | purchase-double-spend
```

## 프로젝트 구조

```
nest-seed/
├── libs/                 ← 공유 라이브러리 (npm 패키지)
│   ├── common/           @mannercode/common  — Mongoose, Redis, JWT, S3, Logger, NATS, Temporal
│   └── testing/          @mannercode/testing — HttpTestClient, fixture 헬퍼
│
├── apps/api/             ← NestJS API (4 replica 기본)
│   ├── src/
│   │   ├── controllers/      HTTP 진입점, 가드
│   │   ├── applications/     비즈니스 로직 (Temporal workflow + activities)
│   │   ├── cores/            도메인 모델, 리포지토리
│   │   ├── infrastructures/  외부 서비스 (결제, 파일)
│   │   └── config/           앱 설정, Rules, 파이프
│   ├── tests/                분산 race 시나리오, perf 하네스
│   └── deploy/               Docker Compose, nginx
│
└── .devcontainer/        ← Dev Container + 개발 인프라
```

## 새 프로젝트로 fork 하기

### 1. 패키지 이름 / 스코프

| 위치                            | 현재            | 변경            |
| ------------------------------- | --------------- | --------------- |
| `package.json` (root)           | `nest-seed`     | 새 프로젝트 이름 |
| `apps/api/package.json`         | `nest-api`      | 새 api 이름     |
| `libs/*/package.json`           | `@mannercode/*` | `@yourorg/*`    |
| `libs/tsconfig.json` (paths)    | `@mannercode/*` | `@yourorg/*`    |
| `apps/api/package.json` (deps)  | `@mannercode/*` | `@yourorg/*`    |

### 2. 환경 / 인프라 식별자

| 위치                       | 현재                                     | 변경         |
| -------------------------- | ---------------------------------------- | ------------ |
| `apps/api/.env`            | `PROJECT_ID=nest-api`                    | 새 ID        |
| `apps/api/deploy/compose.yml` | `image: nest-api`, `container_name: app` | 새 이름      |
| `.devcontainer/infra/.env` | `nest-bucket` (S3 버킷)                  | 새 버킷 이름 |

### 3. 도메인 코드 교체

`apps/api/src/`의 영화 예매 도메인(Users, Movies, Theaters, Showtimes, Tickets, Bookings, Purchases)을 새 도메인으로 교체. 단위 테스트는 `apps/api/src/__tests__/`, e2e 스펙은 `apps/api/tests/e2e/specs/*.spec`.

### 4. CI / 저장소

- `.github/workflows/ci.yaml` — 트리거 분기, 시크릿
- 본 README의 `git clone <repository-url>` 자리

### 5. 유지할 것 (시드의 핵심)

- `libs/` 구조와 코드
- SoLA 계층 분리 (controllers/applications/cores/infrastructures)
- 테스트 인프라 (Jest + Testcontainers + e2e shell spec + 분산 race)
- Dev Container 구성
- ESLint 계층 의존성 검증

### 6. 검증

```bash
npm install              # workspace 정리
npm run build            # libs 빌드
npm run lint             # 의존성·타입·포맷 검사
npm test                 # 테스트 통과 확인
```

---

## 문서

- [아키텍처](docs/architecture.md) — SoLA 계층 분리, 분산 협력 (락 / NATS / Temporal)
- [컨벤션](docs/conventions.md) — 네이밍, 에러, import, REST API 설계
- [테스트](docs/testing.md) — 한글 주석, fixture, dynamic import, 분산 race
- [설계 결정](docs/decisions.md) — 분산 도구의 판단 기준과 거부 목록
