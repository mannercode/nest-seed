# nest-seed

NestJS 모노레포를 빠르게 시작하기 위한 시드 프로젝트이다. Redis, NATS, Temporal 같은 분산 도구를 기본으로 갖추고 있어, 처음에는 모놀리스처럼 단순하게 시작하고 필요할 때 특정 기능을 독립 서비스로 떼어내기 쉽다.

## 시작하기

새 프로젝트로 포크했다면 먼저 `nest-seed`로 검색되는 식별자를 새 프로젝트 이름으로 모두 바꾼다.

Docker, VS Code, Dev Containers 확장이 필요하다. VS Code에서 `Reopen in Container`를 실행하면 MongoDB Replica Set, Redis Cluster, MinIO, NATS, Temporal이 함께 올라온다. 권장 최소 사양은 CPU 4코어, RAM 16GB, 디스크 32GB이다.

| 명령                  | 용도                                                               |
| --------------------- | ------------------------------------------------------------------ |
| `npm test`            | 워크스페이스 테스트 실행 (libs 빌드 자동, console e2e 포함)        |
| `bash deploy/test.sh` | Compose 스택과 curl 기반 API 문서 검증                             |
| `npm run dev`         | libs, api, console, user-app watch 모드 동시 실행 (3000/3100/3200) |
| `npm run atoz`        | 전체 흐름 검증 (포크 후 회귀 확인용)                               |

## 프로젝트 구조

```
nest-seed/
├── libs/                    ← 공유 라이브러리(npm 패키지)
│   ├── temporal-sandbox/    @mannercode/temporal-sandbox — Temporal workflow 샌드박스 헬퍼
│   ├── common/              @mannercode/common  — Mongoose, Redis, JWT, S3, Logger, NATS, Temporal
│   └── testing/             @mannercode/testing — HttpTestClient, 픽스처 헬퍼
│
├── apps/api/                ← NestJS API (배포 시 기본 4개 컨테이너)
│   ├── src/
│   │   ├── services/            서비스 계층
│   │   │   ├── gateway/             HTTP 진입점, 가드(admin/user), 파이프
│   │   │   ├── application/         여러 도메인을 조합하는 작업(Temporal 워크플로 + 액티비티)
│   │   │   ├── view/                View: 화면 전용 서비스 소비자(예: user-app/home)
│   │   │   ├── core/                도메인 모델, 리포지토리
│   │   │   └── infrastructure/      외부 서비스 연동 (결제, 파일)
│   │   ├── config/              환경 변수, 외부 자원 설정
│   │   ├── modules/             NestJS 모듈 연결 (AppConfig, Global, Health, *-setup)
│   │   └── bootstrap.ts         애플리케이션 부팅 진입점
│   └── api-docs/                실행 가능한 API 문서 (curl 기반)
│
├── apps/console/            ← Next.js 관리 콘솔 (로컬 기본 3100 포트)
├── apps/user-app/           ← Next.js 사용자 웹 앱 (로컬 기본 3200 포트)
│
├── tests/
│   ├── api-race/            ← 배포된 API 스택을 대상으로 하는 분산 레이스 시나리오
│   ├── api-perf/            ← 배포된 API 스택을 대상으로 하는 성능 측정 도구
│   └── console-e2e/         ← Playwright 콘솔 e2e 테스트
│
├── deploy/                  ← Docker Compose, NGINX (앱 진입점)
│
└── .devcontainer/           ← Dev Container + 개발 인프라
```

---

## 문서

- [아키텍처](docs/architecture.md) — SoLA 계층 분리와 분산 협력 구조(락, NATS, Temporal)
- [컨벤션](docs/conventions.md) — 네이밍, 에러, 가져오기, REST API 설계
- [테스트](docs/testing.md) — 한글 메시지 규칙, 픽스처, 동적 가져오기, 실행 가능한 API 문서, 분산 레이스 테스트
- [환경 변수](docs/environment.md) — Dev Container, API, API 문서, console 환경 변수 흐름
- [설계 결정](docs/decisions.md) — 분산 도구 선택 기준과 쓰지 않기로 한 대안
