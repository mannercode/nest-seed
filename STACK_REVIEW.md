# 도구·프레임워크·패키지 과잉 검토

최초 검토일: 2026-08-28
상태 갱신: 2026-08-29

## 2026-08-29 상태 갱신

후속 승인에 따라 `pnpm@11.24.0`, API production Rspack 2, Nest 백엔드 ESM, Vitest를 순서대로 독립 전환했다. production build는 Rspack + `ts-loader`, 개발 watch는 TSC, API·common·testing의 Nest 테스트는 Vitest 4를 사용한다. Vitest의 Vite 경로에서는 Oxc를 명시적으로 끄고 SWC도 사용하지 않으며, TypeScript 6 `transpileModule` 변환으로 decorator metadata를 보존한다. Jest·ts-jest의 직접 의존성과 설정은 제거했다.

pnpm은 `pnpm-workspace.yaml`과 `pnpm-lock.yaml`을 단일 기준으로 삼고 내부 package를 `workspace:*`로 연결한다. 아래의 npm 수치·명령과 최초 보류 판단은 2026-08-28 감사 기록으로 읽고, 현재 운영 기준은 이 상태 갱신을 우선한다.

Dependabot의 `package-ecosystem` 값은 pnpm을 다룰 때도 `npm`을 유지한다. 다만 현재 공식 문서의 명시적 호환 범위에 pnpm 11이 포함되지 않으므로, `pnpm-lock.yaml` 갱신 여부는 첫 Dependabot PR에서 확인한다. 이 불확실성만으로 별도 update 도구를 지금 추가하지는 않는다.

## 결론

이 저장소에는 도구가 많지만, 대부분은 서로 다른 실제 경계를 검증하거나 운영한다. 이름이 많다는 이유만으로 합치면 코드보다 검증 능력을 먼저 잃는다. 이번 검토에서 정리 가치가 확인된 범위는 다음과 같다.

| 분류                       | 대상                              | 판단                                                                                                           |
| -------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 지금 제거                  | 사용하지 않는 NATS JetStream 설정 | Core NATS는 유지하고 `-js`, 저장 volume, JetStream 전용 health와 테스트 옵션만 제거                            |
| 승인 전환에서 제거         | Temporal 전체 잔재                | SDK, sandbox, bundle, PostgreSQL, setup, CI 진단까지 Restate 구현과 함께 제거                                  |
| 적용 완료                  | Nest 백엔드와 내부 라이브러리 ESM | TypeScript 6 + Rspack + `ts-loader` 기준에서 별도 커밋으로 전환                                                |
| 적용 완료                  | SWC·Oxc 없는 Vitest               | TypeScript 변환으로 metadata를 보존하고 lifecycle·격리·mock·100% coverage 동등성을 통과한 뒤 Jest·ts-jest 제거 |
| 지금 제거 후보             | 컨테이너 내부 회전 파일 로그      | stdout 로그는 유지하고 영속 volume이 없는 `DailyRotateFile`과 전용 설정을 제거                                 |
| 확정 유지                  | Quick Tunnel, PlantUML            | 외부 HTTPS 검증과 현재 다이어그램 작성·미리보기 경로를 유지                                                    |
| 적용 완료                  | Rspack 2 + `ts-loader`            | Nest 기본 SWC 규칙만 TypeScript compiler 경로로 교체하고 기존 bundle·external·source map 계약 유지             |
| TS 7.1 도구 지원 뒤 재검토 | TypeScript 7 compiler 전환        | TypeScript 7 API와 Nest·`ts-loader`·typescript-eslint 호환성이 확인된 뒤 TypeScript만 별도로 전환              |
| 후속 승인·적용             | pnpm 11.24.0                      | package manager만 별도 전환하고 기존 실행·검증 계약은 유지                                                     |
| 진행 중인 독립 전환        | Zod + Standard Schema             | env 검증을 먼저 옮겼고 request 검증 계약을 이어서 순차 이행                                                    |
| 후속 독립 전환             | MongoDB 공식 driver               | Mongoose가 소유하던 persistence 계약을 repository 구현과 테스트로 재구현                                       |
| 보류                       | Oxlint, Argon2id, Winston 제거    | 새 기본값이라는 이유만으로 바꾸기에는 검증 계약 또는 호환성 비용이 더 큼                                       |
| 유지                       | 나머지 핵심 스택                  | 현재 사용처와 역할이 분명하며 서로 대체 관계가 아님                                                            |

## 확정 방향과 후속 작업

다음 작업자는 아래 기준으로 진행한다.

1. Temporal → Restate 전환은 기존 검증 계약을 유지한 독립 변경으로 완료했다. 다른 build·module·test runner 변경과 섞지 않은 경계도 유지한다.
2. Nest 백엔드의 production TypeScript 변환에는 `@swc/core`·`@swc/cli`·`builtin:swc-loader`를 쓰지 않는다. Rspack config가 Nest 기본 TypeScript 규칙을 `ts-loader`로 교체하며, Next.js 16 프런트엔드의 `@next/swc-*`는 이 결정에 섞지 않는다.
3. TypeScript 6 + Rspack + `ts-loader` bundle을 기준선으로 Nest 백엔드와 내부 라이브러리의 ESM 전환을 완료했다. production build와 개발 watch는 각각 Rspack과 TSC를 사용하며 진입점 의미를 유지한다.
4. API·common·testing의 Nest 테스트는 Vitest로 전환했다. Vite의 Oxc를 비활성화하고 SWC 없이 TypeScript 6 자체 변환을 사용해 decorator metadata를 보존한다. infrastructure lifecycle, 실제 병렬 호출 격리, fake timer·mock 동작, 명시적 coverage include를 통한 미실행 파일 포함 100% coverage와 결과 출력 계약을 모두 통과했으며 Jest·ts-jest의 직접 의존성과 설정은 제거했다. 순수 JavaScript 계약·race 테스트의 `node:test`는 계속 유지한다.
5. TypeScript 7.0은 2026-07-08 정식 출시됐지만 programmatic API가 없다. 현재 Nest CLI 12는 TypeScript `~6.0.2`를 사용하고 `ts-loader`·typescript-eslint 같은 도구도 compiler API가 필요하므로, TypeScript 7.0 CLI와 TypeScript 6 API를 함께 설치하는 이중 compiler 구성은 만들지 않는다. TypeScript 7.1 API와 관련 도구 지원이 확인되면 ESM·Vitest와 별개로 TypeScript 전환을 검토한다.
6. PlantUML은 Mermaid로 전환하지 않고 유지한다. Quick Tunnel도 외부 HTTPS 테스트용 선택 기능과 현재의 공개 차단 정책을 함께 유지한다.
7. devcontainer에 남은 `firsttris.vscode-jest-runner` 제거는 컨테이너 리빌드가 필요한 변경이므로 보류한다. 이는 테스트 runtime 의존성이 아니며, 사용자가 리빌드를 승인하는 시점에 devcontainer 변경으로 따로 처리한다.
8. 전환은 원인 분리가 가능하도록 각각 별도 작업과 커밋으로 진행한다.

이번 감사를 위한 새 상시 의존성은 추가하지 않는다. 현재의 `rg`, `pnpm list --recursive`, `pnpm why --recursive`로 먼저 확인하고, 자동 미사용 판정은 근거가 아니라 후보 목록으로만 사용한다.

## 검토 전제

- 이 시드는 **NestJS 백엔드가 본체**다. `apps/console`과 `apps/user-app`은 최소 동작과 BFF·브라우저 계약을 보여 주는 구색이므로, 프런트엔드 공용 계층이나 별도 `libs/frontend`를 만들지 않는다.
- SWC 금지는 Nest 백엔드의 TypeScript 변환 경로에 한정한다. Rspack 자체의 Rust binding과 optional `@swc/helpers`를 SWC compiler/loader 사용으로 잘못 부르지 않으며, Next.js 16의 `@next/swc-*`는 별도로 판단한다.
- 안정성 검증의 반복 횟수와 3시간/6시간 정기 실행은 줄이지 않는다. 늦게 드러나는 분산 오류를 찾는 장치라서 코드량 절감 대상으로 보지 않는다.
- `PathUtil`은 Node API를 숨기려는 추상화가 아니라 경로·임시 디렉터리·복사·이동을 한 곳에서 읽게 하는 프로젝트 유틸리티다. 사용 코드의 직관성을 우선해 유지한다.
- 이미 승인·완료된 전환 외에는, 단순히 더 새롭거나 벤치마크가 빠르다는 이유로 도구를 교체하지 않는다.
- 반복 선언된 패키지가 곧 불필요한 중복이라는 뜻은 아니다. 각 workspace의 직접 사용 계약일 수 있으므로 manifest에서 기계적으로 지우지 않는다.

## 제안받은 Nest 12 스택 표 검증

제안표에는 Nest 12의 실제 변경, 새 프로젝트의 생성 기본값, 이 저장소와 무관한 설계 선호가 섞여 있다. 따라서 표 전체를 한 번에 적용하지 않고 다음처럼 판정한다.

| 영역                    | 판정                       | 저장소 기준 실익과 전환 비용                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js 26              | 적용 완료·유지             | devcontainer는 `v26.8.1`이다. 다만 검토일 현재 Node 26은 Current이고 LTS 예정일은 2026-10-28이므로, 아직 LTS라는 설명은 틀리다. [Node 릴리스 상태](https://nodejs.org/en/about/previous-releases)                                                                                                                                                                                                                                                  |
| NestJS 12               | 적용 완료·유지             | Nest 패키지는 12.x로 맞췄다.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 애플리케이션 ESM        | 적용 완료                  | API·common·testing에 `type: module`과 `NodeNext`를 적용했다. 상대 specifier는 `.js`, 아키텍처 alias는 `#` package import로 명시하고, Rspack ESM bundle·TSC dev emit·Vitest ESM 실행을 각각 검증한다. [이행 가이드](https://docs.nestjs.com/migration-guide#switching-your-project-to-esm)                                                                                                                                                          |
| TypeScript strict       | 실질 적용·예외 유지        | `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns` 등이 이미 켜져 있다. `strictPropertyInitialization`을 켜면 DTO·ODM이 외부에서 채우는 필드 약 262개가 걸리며, `!`를 일괄 추가하는 것은 안전성 없이 표기만 늘린다. [TS 필드 초기화 규칙](https://www.typescriptlang.org/docs/handbook/2/classes.html#--strictpropertyinitialization)                                                                                                       |
| pnpm                    | 당시 보류 → 후속 적용      | pnpm의 엄격한 dependency 접근과 `workspace:` 보장은 장점이다. 2026-08-28에는 npm 명령이 Docker·CI·문서·계약 테스트 29개 파일에 걸쳐 있어 보류했지만, 후속 승인으로 해당 범위만 독립 전환했다. [pnpm workspace](https://pnpm.io/workspaces), [npm workspace](https://docs.npmjs.com/cli/using-npm/workspaces/)                                                                                                                                      |
| Zod + Standard Schema   | 독립 전환 진행 중          | env 검증은 Zod로 옮겼다. request는 기존 오류 형식·coercion·strict unknown 동작을 고정한 뒤 Nest 12 `StandardSchemaValidationPipe`로 옮긴다. [Nest validation](https://docs.nestjs.com/techniques/validation)                                                                                                                                                                                                                                       |
| MongoDB 공식 driver     | 후속 독립 전환             | 전환 면적이 크지만 후속 지시에 따라 진행한다. schema·index·hook·CAS·transaction 계약을 repository 구현과 테스트로 대체하며 Zod 전환과 같은 커밋에 섞지 않는다. [MongoDB driver](https://www.mongodb.com/docs/drivers/node/current/)                                                                                                                                                                                                                |
| Restate                 | 적용 완료                  | durable step, 재시도와 Saga를 맡기고 Temporal 전용 worker·sandbox·DB를 제거한 승인된 교체다. 검증 조건과 제거 범위는 아래 1.1을 따른다. [Restate durable steps](https://docs.restate.dev/develop/ts/durable-steps)                                                                                                                                                                                                                                 |
| NATS v3                 | 적용 완료·유지             | `@nats-io/transport-node@3.4.0`을 사용해 Nest 12의 NATS v3 전환 요구를 이미 만족한다. [Nest NATS v3](https://docs.nestjs.com/migration-guide#nats-v3)                                                                                                                                                                                                                                                                                              |
| JetStream               | 미사용 설정만 제거         | 앱은 Core NATS의 `publish`·`subscribe`·`flush`만 사용한다. `-js`, 저장 volume과 전용 health를 제거하고, 저장·ack·replay 요구가 생길 때 다시 도입한다. 상세 근거는 아래 1.2를 따른다.                                                                                                                                                                                                                                                               |
| Vitest                  | 적용 완료                  | Oxc를 끄고 SWC 없이 TypeScript 6 변환으로 decorator metadata를 보존한다. global infra lifecycle, 실제 병렬 호출 격리, fake timer·mock과 명시적 include 기반 100% coverage 동등성을 통과해 Jest·ts-jest를 제거했다. 순수 JS 계약·race는 `node:test`를 유지한다. [Nest testing](https://docs.nestjs.com/migration-guide#testing-stack), [Vitest 이행](https://vitest.dev/guide/migration), [Vitest coverage](https://vitest.dev/guide/coverage.html) |
| Rspack / SWC            | Rspack 적용·SWC 변환 금지  | Rspack 2.2.1을 production bundler로 적용했다. Nest 기본 `builtin:swc-loader` 규칙은 `ts-loader`로 교체해 TypeScript 6이 decorator metadata를 생성한다. 개발 watch는 기존 `development.ts` 진입점을 보존하도록 TSC를 유지한다. [Nest Webpack 전환 안내](https://docs.nestjs.com/migration-guide#webpack-deprecation-in-cli-workflows), [Rspack loader 호환](https://www.rspack.dev/guide/features/loader)                                           |
| Oxlint                  | 보류                       | 새 생성 프로젝트의 기본인 것은 맞지만 이 저장소의 ESLint는 SoLA layer, domain boundary와 허용 dependency를 강제한다. Oxlint의 외부 JS plugin은 아직 alpha라 parity 증명 없이 바꾸면 중요한 검사가 조용히 사라질 수 있다. [Oxlint JS plugin 제한](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)                                                                                                                                           |
| OpenTelemetry + Observe | 조합 기각·개별 도입도 보류 | `@nestjs/observe`는 OpenTelemetry SDK가 아니라 Nest Observe 전용 collector/dashboard로 보내는 별도 SDK다. 반대로 OpenTelemetry 공식 Nest 계측기는 현재 Nest `<12`만 지원한다. backend·비용·데이터 반출 정책을 정하기 전에 둘을 함께 넣지 않는다. [Nest Observe](https://github.com/nestjs/observe), [OTel Nest 지원 범위](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-nestjs-core)               |
| REST/OpenAPI            | REST 유지·OpenAPI 보류     | REST는 이미 본체다. OpenAPI는 Nest CLI의 필수 기본이 아니며, 현재 실행 가능한 curl spec과 병행하면 문서 계약이 중복된다. client 생성이나 외부 schema 배포가 필요할 때 기존 spec을 대체할 수 있는지 검토한다. [Nest OpenAPI](https://docs.nestjs.com/openapi/introduction)                                                                                                                                                                          |
| Docker                  | 적용 완료·유지             | 로컬 인프라와 4-replica 배포 검증이 같은 container 경계를 사용하므로 현재 역할이 분명하다.                                                                                                                                                                                                                                                                                                                                                         |

### 사실관계 바로잡기

- Nest 12는 framework package가 ESM-only이지만 기존 애플리케이션의 ESM 전환은 선택 사항이다.
- Vitest는 새 **ESM** 프로젝트, Oxlint는 새 생성 프로젝트의 기본값이다. 기존 프로젝트의 의무 migration은 아니지만 Vitest 검토를 TypeScript 7.1까지 미룰 이유도 없었다. 이 저장소에서는 SWC·Oxc 없는 TypeScript 변환 경로의 동등성을 확인하고 Vitest 전환을 완료했다.
- TypeScript 7.0은 이미 정식 출시됐지만 programmatic API는 7.1 예정이다. 이는 TypeScript compiler 자체의 전환 조건이지 TypeScript 6으로 가능한 ESM 전환의 선행조건이 아니다.
- Next.js 16은 `@next/swc-*`를 선택 의존성으로 사용한다. 백엔드에서는 TypeScript 변환용 SWC loader/compiler를 쓰지 않고 프런트엔드는 별도로 판단한다.
- Zod는 새 Standard Schema 선택지이며 class-validator를 폐기하지 않는다.
- `@nestjs/observe`의 “native observability”는 OpenTelemetry 호환을 뜻하지 않는다.
- Node 26은 앞으로 LTS가 될 기준선이지만 검토일 현재는 아직 Current다.

표에 없지만 Nest 12와 더 직접 관련된 변경은 Webpack 중심 CLI 경로의 deprecation이다. 이 저장소는 Rspack builder를 채택하되 Nest 기본 `builtin:swc-loader`만 `ts-loader`로 교체했다. ESM 전환 뒤에는 Nest 기본 external 계약을 유지하고 `@mannercode/common`의 빌드 산출물을 production dependency tree에 포함한다.

## 1. 지금 제거하거나 승인된 전환에서 제거

### 1.1 Temporal 잔재는 Restate 전환에서 전부 제거

Restate 도입은 승인되어 구현에 반영됐다. 이 교체의 장점은 SDK 이름 변경보다 **Temporal 전용 보조 구조 전체를 없앤 것**에 있다.

제거 범위:

- 루트·API·common의 `@temporalio/*` 패키지와 peer dependency
- `libs/temporal-sandbox/` 전체
- `libs/common/src/temporal/`과 Temporal health indicator
- `apps/api/scripts/bundle-workflows.ts`, `bundle-workflows` 스크립트와 이 용도로만 쓰는 `tsx`
- v1/v2 workflow bundle, legacy worker·lock·activity 호환 경로
- `infra/temporal/`의 Temporal server, PostgreSQL, schema/namespace setup
- Dockerfile과 deploy dependency image의 workflow bundle·sandbox 복사
- `.github/scripts/repeat.sh`의 Temporal PostgreSQL 진단과 관련 구성 계약
- `TEMPORAL_*`, Dependabot 그룹, README와 상세 문서의 과거 설명

전환 검증 항목:

1. 같은 `sagaId` 중복 제출이 새 workflow를 만들지 않는다.
2. 단계 재시도, terminal error, MongoDB 멱등 기록, SSE 상태 순서가 테스트된다.
3. Restate endpoint가 실제 4개 API 복제본으로 라우팅되고, 등록 절차가 deploy 검증에 포함된다.
4. 서버 재시작 후 journal replay가 검증된다.
5. 패키지·소스·인프라에 Temporal과 Restate를 함께 유지하는 dual-runtime 경로가 없다.

이 시드 저장소에는 이관해야 할 운영 execution이 없다는 전제로 직접 전환한다. 실제 운영 데이터가 있는 포크라면 신규 Temporal 제출을 먼저 막고 open execution을 drain/cancel한 뒤 제거해야 한다. Temporal history를 Restate journal로 자동 이관할 수 있다고 가정하면 안 된다.

Restate 쪽도 도구를 늘리지 않는다.

- 공식 `@restatedev/restate-sdk-testcontainers`는 설치하지 않는다. 격리된 Restate 컨테이너가 필요한 테스트를 추가할 때도 현재 `testcontainers`의 `GenericContainer`를 우선한다.
- Restate CLI를 필수 개발 의존성으로 넣지 않고 Admin HTTP API와 health endpoint를 사용한다.
- 개발의 `force` 재등록과 배포의 immutable/version-specific endpoint를 구분한다. 고정 URI에 강제 덮어쓰는 방식은 검증 스택까지만 허용한다.

근거:

- 패키지·소스·환경 설정의 잔재는 `rg -n '@temporalio|TEMPORAL_|temporal-' apps libs infra deploy tools .github package.json pnpm-lock.yaml`로 확인한다. 운영 direct-cutover 경고에서 쓰는 제품명은 제거 대상이 아니다.
- Restate 구현은 `apps/api/src/services/application/showtime-creation/worker/`와 `apps/api/src/config/app-config.service.ts`에 있다.
- [Restate TypeScript SDK 1.16 호환표](https://github.com/restatedev/sdk-typescript/blob/v1.16.9/README.md#versions)
- [Restate server 1.7.8 릴리스](https://github.com/restatedev/restate/releases/tag/v1.7.8)
- [Restate deployment versioning](https://docs.restate.dev/services/versioning)
- [Restate TypeScript testing](https://docs.restate.dev/develop/ts/testing)

### 1.2 NATS는 유지하고 사용하지 않는 JetStream 모드만 제거

앱의 `NatsPubSubService`는 `publish`, `subscribe`, `flush`와 queue group만 사용한다. stream 생성, consumer, ack, replay API는 사용하지 않는다. 구매의 내구성은 JetStream이 아니라 MongoDB outbox/lease가 소유한다.

따라서 다음 설정은 현재 기능에 기여하지 않는다.

- `infra/compose.nats.yml`의 `-js`
- `/data` store와 `nats_data` volume
- `?js-enabled-only=true` health 조건
- 당시 `libs/common/jest.global.cjs`에 있던 `.withJetStream()`

Core NATS 서버와 모니터링 health는 유지한다. NATS 자체를 Redis Pub/Sub으로 다시 쓰면 queue group, broadcast, reconnect 경계를 재검증해야 하므로 이번 정리보다 변화가 크다.

근거:

- `libs/common/src/nats/nats-pubsub.service.ts`
- `apps/api/src/services/application/purchase/internal/purchase-notification.service.ts`
- `apps/api/src/services/application/showtime-creation/showtime-creation.events.ts`
- [Core NATS는 저장·ack 없는 pub/sub이며 queue group을 제공한다](https://docs.nats.io/learn/core-nats/).
- [JetStream은 stream·consumer·ack을 통한 영속 계층이다](https://docs.nats.io/concepts/jetstream).

### 1.3 회전 파일 로그는 stdout과 중복이므로 먼저 제거

`createWinstonLogger`는 모든 실행에서 `DailyRotateFile`을 만들고, deploy API는 `/app/logs`에 기록한다. 그러나 `deploy/compose.yml`에는 그 경로를 보존하는 volume이 없고, 같은 compose가 이미 컨테이너 stdout/stderr를 `max-size=10m`, `max-file=3`으로 회전한다. NGINX도 stdout/stderr로 기록한다.

권고 순서:

1. `DailyRotateFile` transport와 `winston-daily-rotate-file` 제거
2. `LOG_DIRECTORY`, `LOG_DAYS_TO_KEEP`, `LOG_FILE_LEVEL`과 bootstrap의 디렉터리 생성·쓰기 검사 제거
3. Winston console transport, HTTP 포맷, 민감정보 마스킹, 성공 interceptor와 예외 filter는 그대로 유지
4. 테스트별 로그 격리 스크립트에서 파일 로그를 위해 존재한 부분만 정리

이 작업은 로그를 없애는 것이 아니라 **수집되지 않는 두 번째 저장 경로**를 없애는 것이다. 호스트가 실제로 `/app/logs`를 별도 수집하고 있다면 이 항목은 적용하지 않는다.

근거:

- `libs/common/src/logger/create-winston-logger.ts`
- `apps/api/src/bootstrap.ts`
- `.env.api`의 `LOG_*`
- `deploy/compose.yml`의 `logging.options`
- [Docker JSON file logging driver와 rotation 옵션](https://docs.docker.com/engine/logging/drivers/json-file/)

### 1.4 패키지 manifest는 전환 잔재만 정리

Restate 전환 뒤 package 소유자는 `pnpm list --recursive --depth Infinity`와 `pnpm why --recursive <package>`로 다시 확인한다. 우선 제거 대상은 Temporal과 함께 사라지는 패키지뿐이다.

2026-08-28 감사에서 `tests/api-race/eslint.config.cjs`가 `@eslint/js`를 직접 읽으면서 해당 workspace에 선언하지 않은 문제를 찾았다. pnpm 전환에서 `tests/api-race/package.json`의 직접 `devDependency`로 소유권을 바로잡았다.

반대로 다음은 미사용으로 단정하지 않는다.

- `@nestjs/schematics`: `apps/api/nest-cli.json`의 collection이며 Nest 12 CLI도 로컬 CLI와 schematics를 함께 맞추도록 안내한다.
- API의 ESLint plugin들: `apps/api/eslint.config.cjs`가 직접 읽는다.
- root와 workspace에 함께 적힌 Vitest·TypeScript·ESLint 패키지: workspace별 실행 계약이므로 중복 선언만 보고 지우지 않는다.

## 2. 명시적으로 유지

### 2.1 Quick Tunnel 유지

Quick Tunnel은 선택 기능 하나에 다음 비용을 만들지만, 외부 HTTPS 환경에서 실제 브라우저·BFF 계약을 확인하는 개발 경로라서 유지한다.

- `tools/dev-tools/tunnel.sh`, `tunnel-policy.sh`, `tunnel-policy.test.sh`: 합계 353줄
- devcontainer의 `cloudflared` 바이너리 다운로드·checksum·검증 계층
- `tools/dev-tools`의 bin과 테스트 workspace
- `.vscode/tasks.json`, `.env.infra`, README, 환경·GitHub 운영 문서의 정책 설명

현재 공개 차단 정책과 테스트는 tunnel 기능의 안전 경계이므로 기능과 함께 유지한다. 단순 줄 수나 선택 기능이라는 이유로 `cloudflared`, 정책 테스트, 문서와 VS Code 작업을 제거하지 않는다.

### 2.2 PlantUML 유지

현재 PlantUML 블록은 `docs/apps.md`, `docs/deploy.md`, `docs/reference/tutorial.md`에 9개다. Java·Graphviz·JAR·로컬 미리보기 서버까지 포함한 작성 경로가 이미 동작하며 다이어그램 배치도 검증되어 있으므로 유지한다.

- devcontainer의 Java runtime, Graphviz, PlantUML JAR 다운로드와 checksum
- 매 시작 시 PlantUML picoweb 서버
- 5020 forward port와 `jebbs.plantuml` 확장·설정

Mermaid로 바꾸면 일부 도구를 줄일 수 있지만 9개 그림의 배치와 표현을 다시 검증해야 한다. 현재 기능을 없애기 위한 재작성은 하지 않는다.

- [GitHub의 Mermaid 다이어그램 지원](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams)

## 3. 독립 전환과 보류

### 3.1 SWC·Oxc 없는 Vitest 전환 완료

현재 테스트 역할은 다음처럼 나뉜다.

- 순수 JavaScript 계약·race·도구: `node:test`
- Nest 단위·통합과 100% coverage: Vitest
- 브라우저: Playwright
- 부하 측정: k6

Node 26의 TypeScript type stripping은 `tsconfig.json`과 `paths`를 읽지 않는다. Nest 코드는 decorator metadata와 alias를 사용하므로 소스 TS를 `node --test`로 바로 실행하지 않는다. 순수 JavaScript 계약·race는 `node:test`, Nest TypeScript 테스트는 Vitest가 담당한다.

Vitest의 Vite 8 경로에서는 `oxc: false`로 Oxc를 끄고 SWC도 사용하지 않는다. 공통 pre-transform이 TypeScript 6 `transpileModule`을 호출해 legacy decorator metadata와 source map을 보존하며, 타입 검사는 각 workspace의 `tsc --noEmit`이 별도로 담당한다.

API·common·testing 전체에서 infrastructure lifecycle, fake timer·mock, 실패 진단과 tree 출력, 미실행 파일을 포함하는 명시적 `coverage.include` 기반 100% gate를 통과했다. 별도 harness의 실제 병렬 Vitest 호출도 자원·coverage 경로 격리를 통과했다. 이에 따라 Jest·ts-jest 직접 의존성과 설정을 함께 제거했다.

devcontainer의 `firsttris.vscode-jest-runner` 확장은 테스트 runtime과 무관하지만, 제거하면 devcontainer 리빌드가 필요하므로 현재 보류한다. 사용자 승인 뒤 devcontainer 변경으로 별도 처리한다.

- [Node TypeScript 제한](https://nodejs.org/api/typescript.html)
- [Node test runner와 experimental coverage](https://nodejs.org/api/test.html#collecting-code-coverage)
- [Nest 12 testing stack 안내](https://docs.nestjs.com/migration-guide#testing-stack)

### 3.2 Rspack + TypeScript compiler 적용

Nest 12의 Webpack 중심 CLI 경로는 deprecated다. Rspack 자체는 Webpack loader 호환층을 제공하므로, Nest CLI가 만든 기본 Rspack 설정에서 `builtin:swc-loader` 규칙만 `ts-loader@9.6.2`로 교체했다. `@swc/core`와 `@swc/cli`는 백엔드에 설치하거나 호출하지 않는다.

현재 API production build는 다음 계약을 유지한다.

- TypeScript 6이 decorator metadata를 생성하고 기존 type checker가 build를 차단
- `@mannercode/common`을 포함한 런타임 패키지는 Nest 기본값대로 external 처리
- `@mannercode/common`의 `_output/dist`와 전이 의존성은 `pnpm deploy --prod` tree에 포함
- `main.ts → _output/dist/index.js + index.js.map`
- Docker runtime 이미지는 API bundle과 production dependency tree만 복사

Rspack 2.2.1에서 Nest 기본 상대 `resolve.tsConfig`를 그대로 쓰면 native crash가 재현됐다. `context`, native resolver의 `tsConfig`, `ts-loader`의 `configFile`을 API 기준 절대 경로로 고정하고 중복 Webpack resolver plugin은 비활성화해 해결했다. 이 회귀를 숨기는 진단 억제는 추가하지 않았다.

개발 watch는 `nest start --watch`의 TSC 경로를 유지한다. 이 저장소는 production `main.ts`와 개발 `development.ts` 진입점 및 산출물 위치가 다르기 때문에, bundler 전환에서 watch 동작까지 함께 재설계하지 않았다. 완료한 ESM 전환도 Rspack 설정이 보존한 ESM용 rule·output 옵션을 기준으로 검증했다.

TypeScript 7.0은 별도 문제다. programmatic API가 없어 현재 `ts-loader`가 직접 사용할 수 없으므로 TypeScript 7 CLI와 TypeScript 6 API를 함께 두지 않는다. TypeScript 7.1 API와 Nest·`ts-loader`·typescript-eslint 지원이 확인되면 이미 끝난 ESM·Vitest 여부와 독립적으로 compiler 버전만 검토한다.

- `apps/api/rspack.config.cjs`
- [Nest 12 Webpack deprecation 안내](https://docs.nestjs.com/migration-guide#webpack-deprecation-in-cli-workflows)
- [Rspack의 Webpack loader 호환](https://www.rspack.dev/guide/features/loader)
- [TypeScript 7.0의 API 이행 설명](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-60)

### 3.3 bcrypt를 Node 26 내장 Argon2id로 전환

Node 26에는 `node:crypto` Argon2id가 있어 native addon인 `bcrypt`를 없앨 가능성이 있다. 하지만 현재는 바로 바꾸지 않는다.

- 검토일 현재 Node 26은 Current이고 LTS가 아니다.
- 기존 bcrypt hash를 계속 로그인 가능하게 하는 포맷 판별과 로그인 시 재해시 전략이 필요하다.
- root/admin/user의 dummy hash와 timing 방어를 함께 바꿔야 한다.
- Argon2 memory·passes·parallelism을 실제 4-replica 메모리 제한에서 측정해야 한다.

Node 26이 LTS가 된 뒤 `bcrypt verify → 성공 시 Argon2id 재해시` 이행안을 먼저 설계하고 전환한다.

- [Node 릴리스 상태](https://nodejs.org/en/about/previous-releases)
- [Node 26 `crypto.argon2`](https://nodejs.org/api/crypto.html#cryptoargon2algorithm-parameters-callback)

### 3.4 Winston 전면 제거

파일 transport를 제거하고 나면 `winston`도 Nest `ConsoleLogger`로 대체할 후보가 된다. 그러나 현재 logger 영역은 단순 출력 외에 HTTP 성공·예외 기록, context별 포맷, 민감정보 마스킹, 인증 보안 이벤트를 연결한다.

우선 이 기능과 파일 회전을 분리한 뒤, 같은 구조화 필드와 redaction을 보장하는 로그 계약 테스트를 만들 수 있을 때만 `winston`을 제거한다. Pino 같은 다른 외부 logger로 갈아타는 것은 도구 수를 줄이지 않으므로 권고하지 않는다.

- `libs/common/src/logger/`
- `apps/api/src/modules/global.module.ts`
- [Nest built-in logger](https://docs.nestjs.com/techniques/logger)

### 3.5 새 기본값을 따라가는 연쇄 교체

pnpm, Rspack, ESM과 Vitest는 각각 독립 단계로 적용했다. Vitest는 Oxc와 SWC를 끈 TypeScript 변환으로 동등성을 통과했다. 후속인 Zod·MongoDB 공식 driver, 보류한 Oxlint와 Express → Fastify 같은 교체는 각자 독립된 이익과 현재 계약의 parity가 확인될 때만 검토한다. TypeScript 7은 7.1 API와 관련 도구 지원 뒤 별도로 검토한다. Nest 12 신규 프로젝트의 기본값은 기존 저장소의 사용자 정의 계층 규칙, coverage와 build 계약을 폐기할 근거가 아니다. 여러 축을 한 커밋에서 바꾸지 않는다.

## 4. 유지

### 4.1 구조와 검증 강도

| 대상                                                      | 유지 이유                                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `PathUtil`                                                | bootstrap과 파일 유틸리티에서 호출 의도가 바로 보이고, 임시 경로·복사·이동의 공통 오류 처리를 소유함 |
| Stability 5회 reset 주기, 외부 반복, 3시간/6시간 schedule | 짧은 테스트가 발견하지 못하는 누적 정체·경쟁·복제본 장애를 찾는 실제 검증 계약                       |
| API race의 4-replica black-box 검증                       | 단위 테스트나 Testcontainers 한 프로세스로 대체할 수 없음                                            |
| pnpm workspaces                                           | 별도 Nx/Turborepo 없이 내부 package 경계와 `workspace:*` 연결을 제공함                               |
| 실행 가능한 API spec                                      | Swagger/OpenAPI 도입 없이 실제 요청·응답과 redaction을 검증함                                        |

### 4.2 백엔드 핵심 스택

| 대상                           | 유지 이유                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------- |
| NestJS 12 + Express            | 본체이며 현재 guard·pipe·filter·SSE와 통합됨. Fastify 교체 이익이 측정되지 않음  |
| Mongoose + MongoDB Replica Set | transaction, CAS, lease, outbox와 데이터 모델이 실제로 의존함                    |
| ioredis + Redis Cluster        | 캐시, 분산 락, Lua 기반 티켓 선점과 cluster hash slot을 검증함                   |
| Core NATS                      | 복제본 간 broadcast와 queue group을 한 연결 계층으로 제공함                      |
| Restate                        | saga runtime. workflow key·durable step을 쓰고 별도 worker DB·bundle은 두지 않음 |
| VersityGW + AWS SDK            | S3 presigned upload/download와 checksum 흐름의 실제 호환 경계                    |
| Zod + class-validator          | Zod는 process env, class-validator는 전환 중인 request DTO를 검증함              |
| `@nestjs/jwt` + 현재 bcrypt    | 토큰과 password hash는 역할이 다름. bcrypt는 안전한 이행안 전까지 유지           |
| RxJS                           | Nest SSE/Observable 경계에서 실제 사용                                           |

### 4.3 테스트·개발·배포 도구

| 대상                             | 유지 이유                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| Testcontainers                   | common 통합 테스트가 실제 Mongo·Redis·S3·NATS를 검증함                               |
| Playwright                       | 최소 프런트 두 앱의 브라우저 흐름, trace, screenshot과 BFF 계약을 소유함             |
| k6                               | `tests/api-benchmark`의 VU·RPS·latency percentile 측정은 Node runner가 대체하지 못함 |
| NGINX + Docker Compose           | 4개 API 복제본, proxy retry, SSE buffering, 실제 서비스 DNS를 검증함                 |
| ESLint + Prettier                | boundaries, allowed dependencies와 import 규칙은 단순 formatter가 대체하지 못함      |
| Husky + lint-staged + commitlint | 작은 로컬 변경 gate와 커밋 규약을 각각 소유함                                        |
| Dependabot + GitHub Actions      | version update와 전체/반복 검증의 역할이 다름                                        |
| `concurrently`                   | `pnpm run dev`의 watch process 묶음 하나에만 쓰이는 작고 명확한 의존성               |
| `superagent`                     | test client의 multipart, raw error response, abort와 SSE stream을 한 API로 제공함    |

### 4.4 프런트엔드

`apps/console`과 `apps/user-app`은 계속 별도 최소 데모로 둔다. 둘을 합치거나 공용 프런트 library를 만들지 않는다. Next.js·React·Tailwind도 새 UI framework로 교체하지 않고, 백엔드 계약을 보여 주는 현재 범위를 넘겨 확장하지 않는다.

## 5. 새 감사 도구 판단

상시 설치할 새 도구는 없다.

- `pnpm list --recursive`, `pnpm why --recursive`: 설치된 graph와 package 소유자 확인
- `rg`: import, config key, Docker·CI·문서의 간접 사용처 확인
- `pnpm outdated --recursive`: 업그레이드 후보 확인용이며 자동 교체 근거로 쓰지 않음
- Knip: 에이전트가 일회성 후보 수집에 사용할 수는 있지만 Nest DI, Vitest setup, CLI config, workspace peer dependency를 미사용으로 오판할 수 있다. 저장소 dependency나 CI gate로 추가하지 않는다.

[pnpm CLI](https://pnpm.io/cli/list)와 [Knip getting started](https://knip.dev/overview/getting-started)를 참고하되, 삭제 전에는 반드시 `rg`와 실제 build/test 경로로 확인한다.

## 권장 작업 순서

각 항목은 별도 커밋으로 검토한다.

1. ✅ `refactor(workflow): replace temporal with restate`
    - Restate 동작·인프라·테스트를 완성하고 Temporal 전용 범위를 남김없이 제거
2. ✅ `chore(workspace): migrate to pnpm`
    - `pnpm@11.24.0`, workspace/lockfile, scripts·CI·Docker를 package-manager 전용 커밋으로 전환
3. ✅ `build(api): migrate production bundle to rspack`
    - CommonJS 상태에서 Rspack + `ts-loader`의 decorator metadata·산출물·Docker 동등성을 먼저 증명
4. ✅ `build(backend): migrate TypeScript workspaces to esm`
    - API·common·testing을 `NodeNext`와 `"type": "module"`로 전환
5. ✅ `test: migrate Nest workspaces to SWC-free Vitest`
    - Oxc를 끄고 TypeScript 변환으로 decorator metadata를 보존
    - API·common·testing의 infrastructure lifecycle, 실제 병렬 호출 격리, 미실행 파일 포함 100% coverage와 결과 출력을 유지
    - 순수 JavaScript 계약·race의 `node:test`는 유지
    - 동등성 통과 후 Jest·ts-jest 설정과 직접 의존성을 같은 커밋에서 제거
6. ✅ `refactor(config): replace Joi with Zod`
    - 환경 변수 coercion·default·필수값 계약을 보존하고 Joi를 제거
7. `refactor(validation): migrate requests to Zod Standard Schema`
    - request DTO를 옮기고 class-validator·class-transformer는 사용처가 0이 된 다음 제거
8. `refactor(persistence): migrate Mongoose repositories to MongoDB driver`
    - schema·index·hook·CAS·transaction·test fixture 계약을 재구현하므로 다른 stack 전환과 섞지 않음
9. `chore(nats): disable unused jetstream storage`
    - Core NATS 동작과 stability 반복은 유지
10. `refactor(logging): remove ephemeral file transport`
    - stdout, 구조화 필드와 redaction은 유지
11. TypeScript 7.1 API와 Nest·`ts-loader`·typescript-eslint 지원 확인 뒤 TypeScript 7 전환 재검토
    - TypeScript 7.0 CLI와 TypeScript 6 API를 함께 설치하지 않음

Nest 백엔드 production bundle은 Rspack을 사용하되 TypeScript 변환은 `ts-loader`가 담당한다. Nest 테스트는 Oxc·SWC 없이 Vitest와 TypeScript 변환을 사용한다. Next.js 프런트엔드의 `@next/swc-*`는 별도 검토한다. Quick Tunnel과 PlantUML은 유지한다. pnpm·Rspack·ESM·Vitest와 Zod 환경 검증은 독립 단계로 적용했고, 다음은 request Standard Schema, MongoDB driver 순서로 각각 별도 커밋에서 검증한다. Oxlint, Argon2id와 Winston 제거는 현재 후속 승인 범위에 포함하지 않는다.

## 재검토에 사용한 명령

아래 npm 명령은 2026-08-28 최초 감사의 실행 기록이다.

````bash
node --version
npm --version
npm ls --all --workspaces --include-workspace-root
rg --files -g package.json -g '!node_modules'
rg -n 'JetStream|withJetStream|js-enabled-only' infra libs apps
rg -n 'winston|DailyRotate|LOG_DIRECTORY|LOG_FILE_LEVEL' apps libs deploy .env.api
rg -n '@temporalio|TEMPORAL_|temporal-' apps libs infra deploy tools .github package.json package-lock.json
rg -n 'cloudflared|TUNNEL_|npx tunnel' .devcontainer tools .vscode docs README.md
rg -n '^```plantuml|^@startuml' docs
````

최초 검토 시점의 devcontainer runtime은 Node `v26.8.1`, npm `12.0.2`였다. Node 26 이미지와 devcontainer 재빌드는 완료된 상태이며, 이 문서는 런타임을 다시 내리는 권고를 하지 않는다. 2026-08-29 현재 package 운영 기준은 pnpm `11.24.0`이다.
