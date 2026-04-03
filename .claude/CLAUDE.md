# CLAUDE.md

## Project Overview

NestJS 기반 모노레포. 영화 예매 도메인으로 모놀리식(mono)과 마이크로서비스(msa) 아키텍처 시드를 제공한다.

```
nest-seed/
├── libs/                ← 공유 라이브러리 (npm 패키지)
│   ├── common/              @mannercode/common      — Mongoose, Redis, JWT, S3, logging
│   ├── microservices/        @mannercode/microservices — NATS RPC, Temporal workflows
│   └── testing/             @mannercode/testing      — 테스트 컨텍스트, HTTP/RPC 클라이언트
│
├── seeds/                   ← 프로젝트 시드 (복사해서 새 프로젝트 시작)
│   ├── mono/                모놀리식    — NestJS, MongoDB, Redis, BullMQ, EventEmitter2
│   ├── msa/                 마이크로서비스 — NestJS, MongoDB, Redis, NATS, Temporal
│   └── CONVENTIONS.md       프로젝트 컨벤션
│
├── dev-infra/               ← 개발 인프라 (Docker Compose, 환경변수)
│
└── docs/                    ← 아키텍처·설계 문서
```

## Build & Test

```bash
npm ci                  # 의존성 설치
npm run build           # 패키지 빌드 (Turborepo)
npm test                # 패키지 테스트

cd seeds/mono       # 또는 seeds/msa
npm ci
npm test                # 테스트 실행
```

## Architecture

SoLA (Service-oriented Layered Architecture) — 단방향 의존만 허용:

```
Controllers (Gateway) → Applications → Cores → Infrastructures
```

- 동일 계층 간 참조 금지
- 상위 계층만 하위 계층을 참조 가능
- ESLint import 규칙으로 레이어 간 역방향 의존을 차단한다

## Key References

- @seeds/CONVENTIONS.md — 네이밍 규칙, 에러 패턴, 테스트 컨벤션
- @docs/design-guide.md — SoLA 아키텍처, REST API, 엔티티 설계
- @docs/development.md — 개발 환경, 스크립트, 테스트 인프라
- @docs/decisions.md — 기술 선택 근거 (NATS, Temporal)
- @docs/glossary.md — 도메인 용어
- @docs/architecture.md — 패키지 구조, 의존 관계

## Directory Naming

- `libs/common/` — `@mannercode/common`으로 배포되는 범용 라이브러리
- `seeds/*/src/config/` — 앱 내부 설정, 모듈, 파이프 (tsconfig `'config'` 별칭)
- `seeds/*/src/**/cores/shared/` — cores 레이어 내부에서만 공유되는 도메인 모델

## Commit Message

`@commitlint/config-conventional` 사용. `type: subject` 또는 `type(scope): subject` 형식.

types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

## Instructions for Claude

- 대화 중 유용한 정보가 나오면 `docs/`에 문서로 정리한다.
- README.md와 docs/ 문서를 최신 상태로 유지한다.
- 코드 변경 시 관련 문서도 함께 업데이트한다.
- seeds에는 독립 실행 가능한 것만 포함한다. 나머지는 루트에서 관리한다.
