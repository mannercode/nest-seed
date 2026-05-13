# nest-seed

NestJS 모노레포를 시작하기 위한 시드 프로젝트이다. 예시 도메인은 영화 예매이다.

코드는 하나의 `apps/api`에 있지만, 실행할 때는 API 컨테이너 여러 개를 기본으로 둔다. Redis, NATS, Temporal 같은 분산 도구도 처음부터 함께 쓴다. 그래서 개발은 모놀리스처럼 단순하게 시작하고, 필요해지면 특정 기능을 독립 서비스로 떼어내기 쉽다.

## 시작하기

### 1. Dev Container

먼저 Docker, VS Code, Dev Containers 확장이 필요하다.

```bash
git clone <repository-url>
code nest-seed
```

VS Code에서 `Reopen in Container`를 실행하면 개발 컨테이너가 시작된다. MongoDB Replica Set, Redis Cluster, MinIO, NATS, Temporal도 함께 올라온다. 인프라 준비에 시간이 걸리므로, 터미널 로그가 안정된 뒤 다음 단계로 진행한다.

> 컨테이너 안에서도 git을 사용하려면 호스트에 [Git credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials)를 미리 설정해야 한다.

최소 사양은 CPU 4코어, RAM 16GB, 디스크 32GB 이상이다.

### 2. 빌드, 테스트, 실행

```bash
npm test                         # 단위·통합 테스트 (libs 빌드 자동)
bash deploy/test.sh              # Docker Compose로 시작한 뒤 curl 스펙으로 검증
npm run dev                      # libs watch + api watch 동시 실행
curl http://localhost:3000/movies
```

### 3. 분산 레이스 테스트

단일 프로세스 테스트만으로는 여러 API 컨테이너가 동시에 같은 자원에 접근하는 문제를 찾기 어렵다. 그래서 API 컨테이너 4개를 Docker Compose로 시작하고, 외부에서 HTTP 요청을 동시에 보내는 테스트를 따로 둔다.

이 테스트는 다음 상황을 확인한다.

- SSE 이벤트가 모든 API 컨테이너의 클라이언트에게 빠짐없이 전달되는지
- 같은 이메일로 동시에 가입할 때 요청 하나만 성공하는지
- 같은 좌석을 동시에 잡으려 할 때 요청 하나만 성공하는지
- 같은 티켓 묶음이 두 번 결제되지 않는지

이 테스트는 인프라 비용이 크다. 기본 `npm test`에는 넣지 않고, 필요할 때 셸에서 직접 실행한다.

```bash
bash apps/api/tests/runner.sh <scenario>
# scenario: sse | user-race | ticket-holding-race | showtime-overlap-race | purchase-double-spend | replica-chaos | jwt-refresh-race
```

자세한 동작과 검증 방식은 [docs/testing.md](docs/testing.md#5-분산-테스트-복제본-간-레이스)에서 설명한다.

## 프로젝트 구조

```
nest-seed/
├── libs/                    ← 공유 라이브러리 (npm 패키지)
│   ├── common/              @mannercode/common  — Mongoose, Redis, JWT, S3, Logger, NATS, Temporal
│   └── testing/             @mannercode/testing — HttpTestClient, 픽스처 헬퍼
│
├── apps/api/                ← NestJS API (기본 4개 컨테이너)
│   ├── src/
│   │   ├── services/            서비스 코드 묶음
│   │   │   ├── gateway/             HTTP 진입점, 가드, 파이프
│   │   │   ├── application/         여러 도메인을 묶는 작업 (Temporal 워크플로 + 액티비티)
│   │   │   ├── core/                도메인 모델, 리포지토리
│   │   │   └── infrastructure/      외부 서비스 연동 (결제, 파일)
│   │   ├── config/              환경 변수, 외부 자원 진입점
│   │   ├── modules/             NestJS 모듈 연결 (AppConfig, Global, Health, *-setup)
│   │   └── bootstrap.ts         앱 부팅 진입점
│   ├── api-docs/                실행 가능한 API 문서 (curl 기반)
│   └── tests/                   분산 레이스 시나리오, 성능 테스트 도구
│
├── deploy/                  ← Docker Compose, NGINX (앱 진입점)
│
└── .devcontainer/           ← Dev Container + 개발 인프라
```

## 새 프로젝트로 포크하기

이 시드를 새 프로젝트로 가져갈 때 확인할 지점이다.

### 1. 식별자 바꾸기

`nest-seed`를 새 프로젝트 이름으로 바꾼다. `package.json`, `apps/api/.env`, `deploy/compose.yml`, `.devcontainer/infra/.env`에 있는 패키지 이름, `PROJECT_ID`, `AUTH_ISSUER`, S3 버킷 이름도 함께 확인한다.

다만 **`@mannercode` npm 스코프**는 따로 바꿔야 한다. `libs/common`, `libs/testing`의 패키지 스코프는 `nest-seed` 검색에 걸리지 않는다. npm에 배포할 계획이라면 본인 스코프로 바꾼다.

### 2. 도메인 코드 바꾸기

`apps/api/src/`의 영화 예매 도메인(Users, Movies, Theaters, Showtimes, Tickets, Bookings, Purchases)을 새 도메인으로 바꾼다. 통합 테스트는 `apps/api/src/__tests__/` 아래에 있다. 실행 가능한 API 문서(`apps/api/api-docs/*.spec`)도 함께 수정한다.

### 3. CI와 저장소 정리

- `.github/workflows/`의 실행 브랜치와 시크릿을 새 저장소에 맞춘다. `test-atoz.yaml`은 메인 CI이고, `test-stability.yaml`은 분산 레이스 테스트를 여러 번 실행해 안정성을 확인한다.
- 이 README의 `git clone <repository-url>`을 실제 저장소 URL로 바꾼다.

### 4. 유지하면 좋은 것

다음 항목은 이 시드의 핵심이다. 이름은 바꿔도 구조는 유지하는 편을 권한다.

- `libs/` 구조와 코드
- SoLA 계층 분리 (gateway / application / core / infrastructure)
- 테스트 인프라 (Jest + Testcontainers + e2e 셸 스펙 + 분산 레이스 테스트)
- Dev Container 구성
- ESLint 계층 의존성 검증

### 5. 인가 (Authorization) — 포크할 때 추가

이 시드는 **일부 엔드포인트에 인증(`UserJwtAuthGuard`)만 적용하고, 인가(역할 / 소유자 검사)는 의도적으로 넣지 않았다.** 아래 컨트롤러는 가드 없이 열려 있거나, 인증된 사용자가 다른 사용자의 데이터에도 접근할 수 있다. 실제 서비스로 가져갈 때는 도메인 정책에 맞게 관리자 권한과 소유자 전용 검사를 추가해야 한다.

| 컨트롤러                                                      | 노출 동작                                                                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `MoviesHttpController`                                        | 영화 생성/수정/삭제/공개, 에셋 업로드/삭제/완료 처리                                                       |
| `TheatersHttpController`                                      | 극장 생성/수정/삭제                                                                                        |
| `PurchaseHttpController`                                      | 구매 처리. 본문의 `userId`를 그대로 받아 임의 사용자 이름으로 결제할 수 있음                               |
| `ShowtimeCreationHttpController`                              | 상영 시간 대량 생성 요청, SSE 이벤트 스트림                                                                |
| `UsersHttpController` (`@UseGuards(UserJwtAuthGuard)` 적용됨) | 인증된 사용자가 임의 `userId`의 데이터를 읽고 수정하고 삭제할 수 있음. `searchPage`로 모든 사용자 PII 노출 |

권장 방식은 다음과 같다.

- 클래스나 핸들러에 `@UseGuards(UserJwtAuthGuard)`를 붙인다. 통합 테스트 픽스처도 액세스 토큰을 보내도록 고친다.
- 소유자 전용 엔드포인트는 핸들러나 별도 가드에서 `req.user.sub === :userId` 같은 검사를 한다.
- 관리자 전용 엔드포인트는 JWT 페이로드의 role 클레임을 확인하는 가드(`AdminJwtAuthGuard` 등)를 만들어 붙인다.

### 6. 검증

마지막으로 전체 흐름이 깨지지 않았는지 확인한다.

```bash
npm run atoz
```

---

## 문서

- [아키텍처](docs/architecture.md) — SoLA 계층 분리와 분산 협력(락, NATS, Temporal)
- [컨벤션](docs/conventions.md) — 네이밍, 에러, 가져오기, REST API 설계
- [테스트](docs/testing.md) — 한글 메시지 규칙, 픽스처, 동적 가져오기, 분산 레이스 테스트
- [설계 결정](docs/decisions.md) — 분산 도구 선택 기준과 쓰지 않기로 한 대안
