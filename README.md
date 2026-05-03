# nest-seed

NestJS 기반 모노레포. 영화 예매 도메인으로 모놀리식(mono) 아키텍처 시드를 제공한다.

> 이 repo 는 한때 mono 와 msa(NATS RPC + Temporal + Kong) 두 구현을 함께 유지했으나 2026-04-29 에 msa 를 제거했다. 배경·아키텍처 비교·복원 가이드는 [docs/msa-archive.md](docs/msa-archive.md) 참조.

## 시작하기

### 1. Dev Container 실행

사전 요구 사항: Docker, VS Code (Dev Containers 확장)

```bash
git clone <repository-url>
code nest-seed
```

VS Code에서 `Reopen in Container`를 실행한다.

> 호스트에서 [Git credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials)를 미리 설정한다.

컨테이너는 `.devcontainer/devcontainer.json`으로 구성되며, 주요 설정은 다음과 같다.

- 최소 사양: CPU 4, RAM 16GB, Storage 32GB
- `node:24-slim` 기반, non-root 사용자(`node`)로 실행
- Docker-in-Docker로 컨테이너 내에서 Docker 사용
- 컨테이너 생성 시 `npm install` 자동 실행
- 컨테이너 시작 시 인프라(MongoDB RS, Redis Cluster, MinIO) 자동 기동
- sudo 권한이 필요한 패키지는 `.devcontainer/Dockerfile`에서 설치 (예: `npm i -g npm-check-updates husky @commitlint/cli`)

인프라 시작이 완료될 때까지 터미널 출력을 확인한 후 다음 단계를 진행한다.

### 2. libs 빌드

apps가 libs에 의존하므로 먼저 빌드한다.

```bash
npm run build
```

`all:build` 태스크가 기본 빌드로 등록되어 있어 `⌘⇧B`(macOS) / `⌃⇧B`(Linux)로도 실행할 수 있다.

```jsonc
// .vscode/tasks.json
{
    "label": "all:build",
    "group": { "kind": "build", "isDefault": true },
    "type": "shell",
    "command": "npm run build"
}
```

### 3. 단위 테스트

이 프로젝트는 테스트 코드로 기능을 검증하는 방식을 지향한다. libs는 주로 단위 테스트, apps는 통합 테스트에 가깝다.

libs와 apps 전체 단위 테스트를 실행한다.

```bash
npm test
```

개별 앱만 실행하려면:

```bash
npm test -w apps/api
```

### 4. Deploy 테스트

Deploy 테스트는 Docker Compose로 앱을 빌드·실행한 뒤, `specs/` 의 curl 기반 셸 스크립트로 API 가 응답하는지 검증한다. 스펙은 실행 가능한 API 문서 역할도 겸한다.

```bash
bash apps/api/deploy/test.sh
```

스펙은 `specs/` 디렉토리에 `.spec` 셸 스크립트로 작성한다.

```
specs/
├── run.sh                 # 전체 스펙 실행
├── common.fixture        # 공통 셋업
├── assets/                # 테스트용 파일 (이미지 등)
├── customers.spec
├── movies.spec
├── theaters.spec
├── booking.spec
├── purchases.spec
└── showtime-creation.spec
```

스펙 파일 예시 (`customers.spec`):

```bash
TEST "Create a customer" \
    201 POST /customers \
    -H 'Content-Type: application/json' \
    -d '{ "name": "customer name", "email": "'${CUSTOMER_EMAIL}'", ... }'

CUSTOMER_ID=$(echo "${BODY}" | jq -r '.id')

TEST "Login customer" \
    200 POST /customers/login \
    -H 'Content-Type: application/json' \
    -d '{ "email": "'${CUSTOMER_EMAIL}'", "password": "password" }'
```

`TEST` 함수는 `설명`, `기대 상태코드`, `HTTP 메서드`, `URL`, `curl 옵션` 순으로 인자를 받고, 상태코드가 일치하지 않으면 FAIL로 보고한다. 실행 결과는 `_output/logs/`에 기록된다.

### 5. 분산 테스트

4-replica docker compose 스택을 띄워 cross-replica race 를 검증한다 — SSE 팬아웃, 동시 가입/홀드, saga 중첩, 중복 구매 등. package.json 에는 노출하지 않고 shell 로 직접 호출한다. 자세한 내용은 [testing.md#9-분산-테스트](docs/testing.md#9-분산-테스트).

```bash
bash apps/api/tests/runner.sh <scenario>
# scenario: sse | customer-race | ticket-holding-race | showtime-overlap-race | purchase-double-spend
```

### 6. 앱 실행

```bash
cd apps/api
npm run dev
```

앱이 시작되면 API를 호출할 수 있다.

```bash
curl http://localhost:3000/movies
```

## 프로젝트 구조

```
nest-seed/
├── libs/                    ← 공유 라이브러리 (npm 패키지)
│   ├── common/              @mannercode/common
│   └── testing/             @mannercode/testing
│
├── apps/                    ← 백엔드 API (MSA-ready monolith, 4 replica 기본)
│   └── api/                 NestJS, MongoDB, Redis, NATS, Temporal
│
└── .devcontainer/           ← Dev Container + 개발 인프라
```

## 새 프로젝트로 복사해서 사용하기

이 시드를 템플릿으로 사용해 새 프로젝트를 시작할 때 변경해야 할 항목.

### 1. 패키지 이름 / 스코프

| 위치                           | 현재            | 변경             |
| ------------------------------ | --------------- | ---------------- |
| `package.json` (root)          | `nest-seed`     | 새 프로젝트 이름 |
| `apps/api/package.json`        | `nest-api`      | 새 api 이름      |
| `libs/*/package.json`          | `@mannercode/*` | `@yourorg/*`     |
| `libs/tsconfig.json` (paths)   | `@mannercode/*` | `@yourorg/*`     |
| `apps/api/package.json` (deps) | `@mannercode/*` | `@yourorg/*`     |

### 2. 환경 / 인프라 식별자

| 위치                       | 현재                                     | 변경         |
| -------------------------- | ---------------------------------------- | ------------ |
| `apps/api/.env`            | `PROJECT_ID=nest-api`                    | 새 ID        |
| `apps/api/compose.yml`     | `image: nest-api`, `container_name: app` | 새 이름      |
| `.devcontainer/infra/.env` | `nest-bucket` (S3 버킷)                  | 새 버킷 이름 |

### 3. 도메인 코드 교체

`apps/api/src/`의 영화 예매 도메인을 새 도메인으로 교체:

- 모듈/서비스/컨트롤러/모델/DTO: Customers, Movies, Theaters, Showtimes, Tickets, Bookings, Purchases
- 단위 테스트: `apps/api/src/__tests__/`
- e2e 스펙: `apps/api/tests/e2e/specs/*.spec`
- 도메인 용어: `docs/glossary.md`

### 4. CI / 저장소

- `.github/workflows/ci.yaml` — 트리거 분기, 필요 시 시크릿
- README.md의 `git clone <repository-url>` 자리

### 5. 유지할 것 (시드의 핵심)

다음은 그대로 두는 것이 좋다 (스코프 이름만 변경):

- `libs/` 구조와 코드
- SoLA 계층 분리 (controllers/applications/cores/infrastructures)
- 테스트 인프라 (Jest + Testcontainers + e2e shell spec)
- Dev Container 구성
- ESLint 계층 의존성 검증

### 6. 검증

```bash
npm install              # workspace 정리
npm run build            # libs 빌드
npm run lint             # 의존성 깨진 곳 확인
npm test                 # 테스트 통과 확인
```

---

## 문서

- [아키텍처](docs/architecture.md) — 모노레포 구조, SoLA 계층, 서비스 호출 흐름
- [인증](docs/auth.md) — JWT 인증 흐름, Guard 패턴
- [컨벤션](docs/conventions.md) — 네이밍 규칙, 에러 패턴, Import, 커밋 메시지
- [설계 결정](docs/decisions.md) — 주요 기술 선택 근거
- [REST API & 엔티티 설계](docs/design-guide.md) — 리소스 중심 설계, 비정규화
- [개발 환경](docs/development.md) — 스크립트, 환경 파일, Dev Container, 트러블슈팅
- [도메인 용어](docs/glossary.md) — 영화 예매 도메인 용어
- [기술 스택](docs/tech-stack.md) — 채택 현황, 우선순위, 거부 목록
- [libs 개발](docs/libs.md) — 빌드, 테스트, 배포 워크플로우
- [테스트](docs/testing.md) — 테스트 구조, Fixture, 인프라, 커버리지
- [성능 튜닝](docs/perf/README.md) — Phase 1 튜닝 결과
- [MSA 아카이브](docs/msa-archive.md) — 제거된 msa 구현의 기록·복원 가이드
