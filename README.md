# nest-templates

NestJS 기반 모노레포. 영화 예매 도메인으로 모놀리식(mono)과 마이크로서비스(msa) 아키텍처 시드를 제공한다.

## 프로젝트 구조

```
nest-templates/
├── libs/                ← 공유 라이브러리 (npm 패키지)
│   ├── common/              @mannercode/common      — Mongoose, Redis, JWT, S3, logging
│   ├── microservice/        @mannercode/microservice — NATS RPC, Temporal workflows
│   └── testing/             @mannercode/testing      — 테스트 컨텍스트, HTTP/RPC 클라이언트
│
├── seeds/                   ← 프로젝트 시드 (복사해서 새 프로젝트 시작)
│   ├── mono/                모놀리식    — NestJS, MongoDB, Redis, BullMQ, EventEmitter2
│   ├── msa/                 마이크로서비스 — NestJS, MongoDB, Redis, NATS, Temporal
│   └── infra/               공용 인프라 (Docker Compose, 환경변수)
│
└── docs/                    ← 아키텍처 문서
```

두 시드는 동일한 레이어드 아키텍처(SoLA)와 도메인 모델을 공유하며, 통신 및 오케스트레이션 전략이 다르다.

## 시작하기

### 사전 요구 사항

- Node.js 24+
- Docker & Docker Compose

### 1. 의존성 설치

```bash
npm ci
```

### 2. 패키지 빌드

```bash
npm run build
```

### 3. 패키지 테스트

```bash
npm test
```

### 4. 시드 실행

```bash
cd seeds/mono   # 또는 seeds/msa
npm ci
npm run infra:reset
npm test
```

상세 설정은 [seeds/docs/development.md](seeds/docs/development.md) 참조.

## 모노레포 스크립트

| 스크립트                    | 설명                          |
| --------------------------- | ----------------------------- |
| `npm run build`             | 모든 패키지 빌드 (Turborepo)  |
| `npm test`                  | 패키지 테스트 (커버리지 포함) |
| `npm run lint`              | 전체 패키지 ESLint            |
| `npm run format`            | Prettier 포맷팅               |
| `npm run changeset:add`     | 체인지셋 생성                 |
| `npm run changeset:version` | 체인지셋 적용 및 버전 범프    |
| `npm run changeset:publish` | 빌드 후 npm 배포              |

## 기술 스택

| 분류                  | 기술                       |
| --------------------- | -------------------------- |
| **프레임워크**        | NestJS 11                  |
| **언어**              | TypeScript 6               |
| **데이터베이스**      | MongoDB (Mongoose)         |
| **캐시**              | Redis                      |
| **메시징**            | NATS (msa)                 |
| **워크플로우**        | Temporal (msa)             |
| **큐**                | BullMQ (mono)              |
| **이벤트**            | EventEmitter2 (mono)       |
| **오브젝트 스토리지** | MinIO (S3 호환)            |
| **인증**              | JWT + Passport             |
| **테스트**            | Jest (100% 커버리지)       |
| **빌드**              | Turborepo + Webpack        |
| **컨테이너**          | Docker (multi-stage build) |
| **패키지 매니저**     | npm workspaces             |
| **버전 관리**         | Changesets                 |

## Mono vs MSA 비교

| 항목           | mono                       | msa                                    |
| -------------- | -------------------------- | -------------------------------------- |
| 서비스         | 1 (단일 프로세스)          | 4 (Gateway, Apps, Cores, Infra)        |
| 레이어 간 통신 | 직접 함수 호출             | NATS RPC                               |
| 비동기 처리    | BullMQ 큐                  | Temporal 워크플로우 (Saga 패턴)        |
| 이벤트         | EventEmitter2 (in-process) | NATS pub/sub                           |
| 인프라         | MongoDB RS + Redis Cluster | + NATS Cluster + Temporal + PostgreSQL |
| 포트           | 3000                       | 3000, 4000, 4001, 4002                 |

## 문서

- [패키지 아키텍처](docs/architecture.md) — 모노레포 구조, 패키지 의존 그래프, 모듈 상세
- [설계 가이드](seeds/docs/design-guide.md) — SoLA 아키텍처, REST API 설계, 엔티티 설계
- [프로젝트 컨벤션](seeds/CONVENTIONS.md) — 네이밍 규칙, 테스트 컨벤션
- [개발 환경](seeds/docs/development.md) — 스크립트, 프로젝트 구조, ESLint 규칙
- [설계 결정](seeds/docs/decisions.md) — NATS, Temporal 선택 근거
- [도메인 용어](seeds/docs/glossary.md) — 영화 예매 도메인 용어 정리

## 라이선스

개별 패키지의 라이선스 정보를 참조.
