# CLAUDE.md

## Project Overview

NestJS 기반 모노레포. 영화 예매 도메인으로 모놀리식(mono)과 마이크로서비스(msa) 아키텍처 템플릿을 제공한다.

```
nest-templates/
├── packages/                ← 공유 라이브러리 (npm 패키지)
│   ├── common/              @mannercode/common      — Mongoose, Redis, JWT, S3, logging
│   ├── microservice/        @mannercode/microservice — NATS RPC, Temporal workflows
│   └── testing/             @mannercode/testing      — 테스트 컨텍스트, HTTP/RPC 클라이언트
│
├── seeds/                   ← 프로젝트 시드 (복사해서 새 프로젝트 시작)
│   ├── mono/                모놀리식    — NestJS, MongoDB, Redis, BullMQ, EventEmitter2
│   └── msa/                 마이크로서비스 — NestJS, MongoDB, Redis, NATS, Temporal
│
└── docs/                    ← 아키텍처, 네이밍, 테스트 문서
```

## Build & Test

```bash
npm ci                  # 의존성 설치
npm run build           # 패키지 빌드 (Turborepo)
npm test                # 패키지 테스트

cd seeds/mono       # 또는 seeds/msa
npm ci
npm run infra:reset     # Docker 인프라 시작
npm test                # 테스트 실행
```

## Architecture

SoLA (Service-oriented Layered Architecture) — 단방향 의존만 허용:

```
Controllers (Gateway) → Applications → Cores → Infrastructures
```

ESLint import 규칙으로 레이어 간 역방향 의존을 차단한다.

## Conventions

각 템플릿의 상세 컨벤션은 해당 디렉토리의 문서를 참고:

- [seeds/mono/CONVENTIONS.md](seeds/mono/CONVENTIONS.md)
- [seeds/msa/CONVENTIONS.md](seeds/msa/CONVENTIONS.md)
- [docs/naming-conventions.md](docs/naming-conventions.md) — 디렉토리/파일/클래스/메서드 네이밍

## Directory Naming: common vs shared

- `packages/common/` — `@mannercode/common`으로 배포되는 범용 라이브러리
- `seeds/*/src/config/` — 앱 내부 설정, 모듈, 파이프 (tsconfig `'config'` 별칭)
- `seeds/*/src/**/cores/shared/` — cores 레이어 내부에서만 공유되는 도메인 모델

## Testing

- Mock 없음 — 실제 MongoDB RS, Redis Cluster, NATS, MinIO, Temporal 사용
- 커버리지 100% 강제 (branches, functions, lines, statements)
- Fixture 패턴 — `createXxxFixture()`로 격리된 테스트 컨텍스트 생성
- 테스트 describe/it에 한글 주석 사용
- `beforeEach`로 조건 설정, `it`에서는 검증만

## Documentation

- [README.md](README.md) — 프로젝트 소개, 시작 가이드
- [docs/architecture.md](docs/architecture.md) — 아키텍처, 패키지 구조, 템플릿 비교
- [docs/naming-conventions.md](docs/naming-conventions.md) — 네이밍 규칙 상세
- [docs/testing-strategy.md](docs/testing-strategy.md) — 테스트 원칙, 패턴, 설정

## Instructions for Claude

- 대화 중 유용한 정보가 나오면 `docs/`에 문서로 정리한다.
- README.md와 docs/ 문서를 최신 상태로 유지한다.
- 코드 변경 시 관련 문서도 함께 업데이트한다.
