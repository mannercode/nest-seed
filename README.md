# nest-seed

NestJS 모노레포 시드다. 영화 예매 도메인을 예시로 담았으며, 구조는 **MSA-ready monolith** 를 지향한다. 코드는 단일 `apps/api` 안에 모여 있지만 4 replica로 기본 배포되고, NATS와 Temporal 같은 분산 인프라를 그대로 유지한다. 나중에 서비스를 분리해야 할 때가 와도 인프라는 교체할 필요 없이 코드 경계만 끊으면 되도록 설계했다.

## 시작하기

### 1. Dev Container

먼저 Docker와 VS Code, 그리고 Dev Containers 확장이 필요하다.

```bash
git clone <repository-url>
code nest-seed
```

VS Code에서 `Reopen in Container`를 실행하면 컨테이너가 뜨면서 MongoDB Replica Set, Redis Cluster, MinIO, NATS, Temporal이 자동으로 함께 기동된다. 인프라 초기화에는 약간 시간이 걸리므로, 터미널에 출력되는 로그가 안정될 때까지 기다린 뒤 다음 단계로 넘어간다.

> 호스트에 [Git credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials) 설정이 미리 되어 있어야 컨테이너 안에서도 git이 동작한다.

권장 사양은 CPU 4코어, RAM 16GB, 디스크 32GB 이상이다.

### 2. 빌드하고 테스트하고 실행하기

`apps/api`가 `libs/*`에 의존하기 때문에, 가장 먼저 libs를 빌드해야 한다.

```bash
npm run build                    # libs 빌드
npm test                         # 단위·통합 테스트
bash apps/api/deploy/test.sh     # Docker Compose로 빌드·기동한 뒤 curl 스펙으로 검증
cd apps/api && npm run dev       # watch 모드로 개발 서버 실행
curl http://localhost:3000/movies
```

### 3. 분산 race 테스트

단일 프로세스로는 재현하기 어려운 race 조건을 검증하기 위해, 4-replica docker compose 스택을 띄우고 블랙박스 시나리오를 돌리는 테스트가 따로 있다. SSE 팬아웃이 모든 replica로 전달되는지, 동일 이메일로 동시에 가입을 시도하면 한 건만 성공하는지, 같은 좌석을 동시에 홀드하면 한 건만 통과하는지, 같은 티켓 세트가 중복 결제되지 않는지 등을 다룬다.

이 테스트는 인프라가 무거워서 `package.json` 스크립트로 노출하지 않고 shell에서 직접 호출한다.

```bash
bash apps/api/tests/runner.sh <scenario>
# scenario: sse | user-race | ticket-holding-race | showtime-overlap-race | purchase-double-spend | replica-chaos | jwt-refresh-race
```

자세한 동작과 검증 방식은 [docs/testing.md](docs/testing.md#5-분산-테스트-cross-replica-race)에서 다룬다.

## 프로젝트 구조

```
nest-seed/
├── libs/                    ← 공유 라이브러리 (npm 패키지)
│   ├── common/              @mannercode/common  — Mongoose, Redis, JWT, S3, Logger, NATS, Temporal
│   └── testing/             @mannercode/testing — HttpTestClient, fixture 헬퍼
│
├── apps/api/                ← NestJS API (4 replica 기본)
│   ├── src/
│   │   ├── gateway/             HTTP 진입점, 가드
│   │   ├── application/         비즈니스 로직 (Temporal workflow + activities)
│   │   ├── core/                도메인 모델, 리포지토리
│   │   ├── infrastructure/      외부 서비스 (결제, 파일)
│   │   └── config/              앱 설정, Rules, 파이프
│   ├── api-docs/                실행 가능한 API 문서 (curl 기반)
│   ├── tests/                   분산 race 시나리오, perf 하네스
│   └── deploy/                  Docker Compose, nginx
│
└── .devcontainer/           ← Dev Container + 개발 인프라
```

## 새 프로젝트로 fork 하기

이 시드를 가져다 새 프로젝트를 시작할 때 손대야 할 자리들을 정리한다.

### 1. 식별자 치환

`nest-seed` 를 새 프로젝트 이름으로 일괄 치환한다. `package.json`, `apps/api/.env`, `apps/api/deploy/compose.yml`, `.devcontainer/infra/.env` 등에 흩어진 식별자(패키지 이름, `PROJECT_ID`, `AUTH_ISSUER`, S3 버킷 등)가 한 번에 잡힌다.

다만 다음 두 가지는 단순 치환만으로 끝나지 않는다.

- **GHCR deps 이미지 경로** — `apps/api/scripts/ensure-deps-image.sh` 와 `apps/api/Dockerfile` 의 `ghcr.io/mannercode/nest-seed/deps` 는 시드 저장소가 사전 빌드해 둔 이미지다. 포크 후에는 본인 저장소에 deps 이미지를 빌드·푸시한 뒤 그 경로로 바꾼다.
- **`@mannercode` npm 스코프** — `libs/common`, `libs/testing` 의 패키지 스코프는 `nest-seed` 검색에 잡히지 않는다. npm 으로 배포할 계획이라면 본인 스코프로 따로 치환한다.

### 2. 도메인 코드 교체

`apps/api/src/`에 들어 있는 영화 예매 도메인(Users, Movies, Theaters, Showtimes, Tickets, Bookings, Purchases)을 새 도메인으로 교체한다. 단위 테스트는 `apps/api/src/__tests__/` 아래에, 실행 가능한 API 문서는 `apps/api/api-docs/*.spec` 에 있으므로 함께 수정한다.

### 3. CI와 저장소 정리

- `.github/workflows/` 의 트리거 분기와 시크릿을 새 저장소 기준으로 맞춘다 (`test-atoz.yaml` 이 메인 CI, `test-stability.yaml` 이 분산 race 누적 측정, `build-deps-image.yaml` 이 GHCR deps 이미지 빌드).
- 본 README의 `git clone <repository-url>` 자리를 실제 URL로 바꾼다.

### 4. 유지하면 좋은 것

다음 항목들은 시드의 핵심이라 이름만 바꾸고 구조는 그대로 두기를 권한다.

- `libs/` 의 구조와 코드
- SoLA 계층 분리 (gateway / application / core / infrastructure)
- 테스트 인프라 (Jest + Testcontainers + e2e shell spec + 분산 race)
- Dev Container 구성
- ESLint 계층 의존성 검증

### 5. 인가 (Authorization) — 포크 시 추가

이 시드는 **인증 (`UserJwtAuthGuard`) 만 일부 엔드포인트에 걸려 있고, 인가
(role / ownership 검사) 는 의도적으로 빠져 있다**. 다음 컨트롤러는 가드 없이
공개되어 있어 익명 / 모든 인증 사용자가 mutate 할 수 있다 — 실 서비스로
가져갈 때 fork 한 쪽이 도메인 정책 (admin role, owner-only 등) 에 맞춰 가드와
검사를 채워 넣어야 한다.

| 컨트롤러 | 노출 동작 |
|---|---|
| `MoviesHttpController` | 영화 생성/수정/삭제/publish, asset 업로드/삭제/finalize |
| `TheatersHttpController` | 극장 생성/수정/삭제 |
| `PurchaseHttpController` | 구매 처리. body 의 `userId` 를 그대로 받아 임의 사용자 명의로 결제 가능 |
| `ShowtimeCreationHttpController` | bulk 상영시간 생성 요청, SSE 이벤트 스트림 |
| `UsersHttpController` (`@UseGuards(UserJwtAuthGuard)` 적용됨) | 인증된 사용자가 임의 userId 의 데이터 read/update/delete + `searchPage` 로 모든 사용자 PII 노출. owner/admin 검사 없음 |

추천 패턴:
- 클래스/핸들러에 `@UseGuards(UserJwtAuthGuard)` 추가하고 통합 fixture 도 액세스 토큰을 같이 보내도록 갱신
- owner-only 엔드포인트는 `req.user.sub === :userId` 같은 검사를 핸들러 또는 별도 가드에서 수행
- admin 전용은 JWT payload 의 role claim 을 검증하는 가드 (`AdminJwtAuthGuard` 등) 신규 추가

### 6. 검증

마지막으로 전체가 깨지지 않았는지 다음 명령들로 확인한다.

```bash
npm run atoz
```

---

## 문서

- [아키텍처](docs/architecture.md) — SoLA 계층 분리와 분산 협력 (락, NATS, Temporal)
- [컨벤션](docs/conventions.md) — 네이밍, 에러, import, REST API 설계
- [테스트](docs/testing.md) — 한글 메시지 규칙, fixture, dynamic import, 분산 race
- [설계 결정](docs/decisions.md) — 분산 도구의 판단 기준과 거부 목록
