# 패키지 아키텍처

## 모노레포 구조

```
nest-seed/
├── libs/              # 공유 라이브러리 (@mannercode/*)
│   ├── common/            # 기본 유틸리티 (Mongoose, Redis, JWT, S3, Logger)
│   ├── microservices/      # MSA 유틸리티 (NATS RPC, Temporal)
│   └── testing/           # 테스트 유틸리티 (HttpTestClient, RpcTestClient)
├── seeds/
│   ├── mono/              # 모놀리식 NestJS 시드
│   └── msa/               # 마이크로서비스 아키텍처 시드
├── turbo.json             # Turborepo 태스크 파이프라인
└── package.json           # npm workspaces 루트
```

## 패키지 의존 그래프

```
@mannercode/common          ← 내부 의존 없음 (devDep: testing)
@mannercode/microservices   ← common에 의존   (devDep: testing)
@mannercode/testing         ← 내부 의존 없음
```

소스 코드(빌드 결과물) 기준 의존 방향:

```
microservices → common
testing       → (독립)
```

common과 microservices는 테스트(devDependencies)에서만 testing을 사용한다.
testing은 내부에 필요한 유틸을 복제(`internals.ts`)하여 다른 `@mannercode` 패키지에 의존하지 않는다.

## 패키지 상세

### @mannercode/common

기반 레이어. 모든 NestJS 애플리케이션에서 재사용 가능한 인프라 추상화를 제공한다.

| 모듈           | 주요 export                                                                              |
| -------------- | ---------------------------------------------------------------------------------------- |
| **mongoose**   | `MongooseRepository`, `MongooseSchema`, 페이지네이션 지원                                |
| **redis**      | `RedisModule`, 연결 관리                                                                 |
| **cache**      | `CacheService`, `CacheModule`, 네임스페이스 키, TTL, Lua                                 |
| **auth**       | JWT/Local/Optional Guard, `JwtAuthService`, `@Public()` — [상세](auth.md)                |
| **s3**         | `S3ObjectService`, 업로드/다운로드, presigned URL                                        |
| **logger**     | `AppLoggerService`, Winston, `HttpExceptionLoggerFilter`, `HttpSuccessLoggerInterceptor` |
| **pagination** | `PaginationDto`, `PaginationResult`, `OrderBy`                                           |
| **health**     | `RedisHealthIndicator`                                                                   |
| **config**     | `BaseConfigService`                                                                      |
| **validator**  | `Require`, `Verify`, `ensure()`                                                          |
| **utils**      | env, base64, byte, checksum, date, time, http, json, path                                |

### @mannercode/microservices

분산 시스템을 위한 통신 및 오케스트레이션 레이어.

| 모듈         | 주요 export                                                                               |
| ------------ | ----------------------------------------------------------------------------------------- |
| **logger**   | `RpcExceptionLoggerFilter`, `RpcSuccessLoggerInterceptor` — HTTP 필터를 상속하여 RPC 추가 |
| **rpc**      | `ClientProxyService`, `ClientProxyModule` — NATS RPC, 자동 재시도 (최대 9회, 지수 백오프) |
| **temporal** | `TemporalClientModule`, `TemporalWorkerService` — 워크플로우 번들링 및 라이프사이클 관리  |

### @mannercode/testing

테스트 인프라 레이어.

| 모듈                  | 주요 export                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| **test context**      | `createTestContext()`, `createHttpTestContext()` — 격리된 NestJS 테스트 모듈 |
| **http test client**  | `HttpTestClient` — fluent API (`.post().body().created()`)                   |
| **rpc test client**   | `RpcTestClient` — `.expectRequest()`, `.expectError()`                       |
| **infra connections** | `getRedisTestConnection()`, `getMongoTestConnection()` 등                    |
| **jest utilities**    | Mocking, spying, fake timers 헬퍼                                            |

아키텍처 상세(SoLA, 레이어 책임, 도메인 설계)는 [설계 가이드](design-guide.md) 참조.
