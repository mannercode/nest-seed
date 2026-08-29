# 제안된 Nest 12 최종 스택에 대한 의견

최초 검토일: 2026-08-28
상태 갱신: 2026-08-29

2026-08-29 후속 결정으로 `pnpm@11.24.0`, Rspack + `ts-loader`, 백엔드 ESM, Vitest를 각각 독립 전환했다. Zod 단계는 환경 설정 검증부터 적용했고 request Standard Schema 전환을 이어서 진행한다. 이 문서의 2026-08-28 최초 보류 판단은 당시 기록으로 남기되, 이후 순서는 MongoDB 공식 driver이다.

## 한 줄 결론

제안안의 방향은 채택하되 현재 저장소에 한 번에 덮어쓰지 않는다. Node 26·Nest 12·Restate·NATS v3·pnpm·Rspack·ESM·Vitest는 순차 적용했고, 남은 Zod와 MongoDB 공식 driver도 같은 원칙으로 독립 전환한다. Oxlint·observability는 아직 별도 선택으로 남긴다.

내 최종안은 다음 두 줄로 구분된다.

- Greenfield 분산 시드: **Node 26(LTS 전환 뒤 운영 기준) + Nest 12 ESM + TypeScript strict + pnpm + Vitest + Zod + MongoDB driver + Restate + Core NATS + Docker + OpenTelemetry 또는 Nest Observe 중 하나**
- 현재 저장소: **Node 26(Current) + Nest 12 ESM + TypeScript 6 strict + pnpm 11 + Rspack/`ts-loader` + Vitest 4/`node:test` + Zod(env)/class-validator(request) + Mongoose + Restate + Core NATS + Docker**

두 번째 줄은 낡은 구성을 고집하자는 뜻이 아니다. 이 저장소가 이미 검증하는 경쟁 조건, 재시작, 4개 복제본, 100% coverage와 배포 산출물이 자산이므로, 새 도구가 그 계약을 실제로 더 작고 명확하게 대체할 때만 옮기자는 뜻이다. 더 넓은 과잉 검토는 [STACK_REVIEW.md](./STACK_REVIEW.md), 테스트 구조와 결과 확인 방식은 [TESTS_REVIEW.md](./TESTS_REVIEW.md)를 함께 참고한다.

## 1. Greenfield 최소 시드로서 좋은 점

새 저장소라면 제안안에는 다음 장점이 있다.

1. 처음부터 ESM·schema-first·Vitest로 맞추므로 CommonJS adapter, decorator DTO와 runner 이행 비용이 없다.
2. MongoDB 공식 driver를 repository 뒤에 두면 ODM의 hook·casting·document 상태를 기본 설계로 강제하지 않고 MongoDB 동작을 명시적으로 드러낼 수 있다.
3. durable command와 event fan-out을 Restate와 NATS로 분리해 message broker 하나에 workflow·retry·timer·broadcast를 모두 떠넘기지 않는다.
4. Core NATS로 시작하고 replay가 필요한 이벤트에만 JetStream을 켜면 모든 메시지에 저장 비용을 부과하지 않는다.
5. Nest 12 신규 ESM 프로젝트의 Vitest와 신규 프로젝트의 Oxlint 기본값을 처음부터 쓰면 별도 migration 없이 생태계의 새 기준선에 설 수 있다. 이는 **새 프로젝트 생성 기본값**이지 기존 프로젝트의 의무 전환은 아니다. [Nest 12 migration guide](https://docs.nestjs.com/migration-guide#new-project-defaults)

다만 이 조합을 일반적인 “최소 Nest 시드”라고 부르기는 어렵다. Restate, NATS와 telemetry backend는 분산 실행·서비스 간 fan-out·관측 요구가 있을 때만 값어치를 한다. 범용 시드라면 이 셋은 선택 profile이어야 하고, 이 저장소처럼 Saga와 다중 복제본을 실제로 보여 주는 **분산 백엔드 시드**라면 기본 구성으로 둘 수 있다.

## 2. 현재 저장소에서는 판단 기준이 다르다

현재 저장소는 빈 Nest 프로젝트가 아니다. 아래 숫자는 진행 중이던 Restate 변경까지 포함한 **2026-08-28 최초 검토 시점** working tree의 전환 표면이다. 검색 범위에 따라 숫자는 달라질 수 있으므로 규모 판단과 의사결정 기록으로만 사용한다.

| 계약 또는 표면  | 2026-08-28 근거                                                                              |
| --------------- | -------------------------------------------------------------------------------------------- |
| 모듈 형식       | 상대 경로의 확장자 없는 import/require 약 884곳·344개 파일, JS/CJS 파일 49개, CJS 표현 164곳 |
| package manager | `packageManager: npm@12.0.2`, npm 명령이 Docker·CI·문서·계약을 포함한 약 30개 파일에 존재    |
| Mongoose        | 관련 import 71개 파일, `@Prop()` 105곳, `@InjectModel()` 16곳, 공용 Mongoose 계층 2,575줄    |
| DTO validation  | class-validator import 49개 파일, `*Dto` class 선언 53곳                                     |
| test runner     | API·common·testing의 Jest 설정, 전역 setup/teardown, Testcontainers와 include-all coverage   |
| 운영·경쟁 검증  | 4-replica race, 5회 reset 반복, 3시간/6시간 stability, 실행 가능한 API spec                  |
| lint            | SoLA layer·domain boundary·허용 dependency를 custom ESLint 규칙으로 강제                     |

수치는 migration 크기를 비교하기 위한 검색 결과이지 코드 품질 점수가 아니다. 특히 Mongoose 2,575줄은 “불필요한 ODM 코드”가 아니라 schema·index·hook·transaction·CAS와 repository 계약을 담고 있다. 테스트 반복도 늦게 드러나는 분산 오류를 찾기 위한 의도된 비용이다.

따라서 현재 저장소의 판단 기준은 “최신 기본값인가”가 아니라 다음 세 가지다.

1. 기존에 잡던 실패를 계속 잡는가.
2. 설정·adapter·의존성의 총량이 실제로 줄어드는가.
3. 한 축씩 바꿔 실패 원인을 분리할 수 있는가.

## 3. 동의·조건부 동의·반대

| 제안                                   | 판단                  | 현재 저장소에 대한 의견                                                                                |
| -------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------ |
| Node.js 26                             | 동의·적용됨           | 미래 기준선으로 유지하되 2026-08-28 현재 Current임을 명시한다.                                         |
| NestJS 12                              | 동의·적용됨           | 12.x 정렬은 유지한다. 앱 ESM 전환과는 별개다.                                                          |
| TypeScript strict                      | 동의·적용됨           | `strict`와 추가 안전 옵션은 유지한다. 외부에서 채워지는 DTO·ODM 필드를 위한 예외까지 없앨 필요는 없다. |
| Restate로 durable execution            | 동의·적용됨           | Temporal을 대체해 command/workflow/retry/timer/Saga/compensation을 맡는다.                             |
| NATS v3와 Core NATS fan-out            | 동의·적용됨           | domain notification, pub/sub와 queue group에 사용한다.                                                 |
| JetStream opt-in                       | 동의                  | 저장·ack·replay 요구가 생긴 subject에만 도입한다. 현재 미사용 설정은 제거한다.                         |
| Docker                                 | 동의·적용됨           | 로컬 인프라와 실제 4-replica 경계를 같은 방식으로 검증한다.                                            |
| `type: module` ESM                     | 동의·적용됨           | API·common·testing을 NodeNext ESM으로 옮기고 bundle·TSC dev·Docker parity를 검증한다.                  |
| pnpm workspace                         | 당시 조건부 → 적용됨  | 2026-08-28에는 보류했지만, 후속 승인으로 package manager만 `pnpm@11.24.0`으로 별도 전환했다.           |
| Vitest                                 | 동의·적용됨           | SWC·Oxc 없이 lifecycle·mock·100% coverage·결과 출력을 보존하고 Jest·ts-jest를 제거했다.                |
| Zod + Standard Schema                  | 전환 진행 중          | env 검증은 Zod로 옮겼고 request 검증을 이어서 옮긴 뒤 기존 검증 의존성을 제거한다.                     |
| MongoDB 공식 driver 우선               | 후속 전환             | 큰 변화를 수용하되 repository·schema·transaction 계약을 동일 강도로 재구현한다.                        |
| Oxlint                                 | 조건부                | 현재 architecture 규칙을 모두 대체할 수 있을 때만 ESLint와 교체한다.                                   |
| OpenTelemetry                          | 조건부                | 수집 backend와 Nest 12 호환 경로가 정해진 뒤 도입한다.                                                 |
| Nest Observe                           | 조건부                | OTel의 Nest wrapper로 보지 말고 별도 APM 제품 선택으로 판단한다.                                       |
| Jest/ts-jest 전면 제거                 | 적용됨                | Vitest lifecycle·coverage·진단 동등성을 통과한 뒤 임시 CJS bridge와 함께 제거했다.                     |
| class-validator/class-transformer 제거 | Zod 단계에서 진행     | request/response 계약을 Zod로 옮기고 사용처가 사라진 뒤 제거한다.                                      |
| Mongoose 전면 제거                     | driver 단계에서 진행  | repository 구현, schema와 transaction을 다시 쓰는 독립 작업으로 진행한다.                              |
| outbox 기본 제거                       | 조건 없는 안에는 반대 | “NATS event는 유실 가능”이라고 정의할 때만 제거 가능하다. 보장 이벤트에는 다른 원자성 전략이 필요하다. |
| OTel + Observe 동시 기본 설치          | 반대                  | 같은 기술이 아니며 수집·비용·데이터 반출 경로도 둘이 된다. 하나를 선택해야 한다.                       |
| 위 변경의 일괄 적용                    | 반대                  | module, package graph, test, validation, persistence와 telemetry 실패를 한 번에 섞는다.                |

## 4. Restate·Mongo·NATS의 책임 분리는 채택한다

제안안에서 가장 좋은 부분은 제품 목록보다 책임 경계다.

| 구성 요소 | 맡길 책임                                                                  | 맡기지 않을 책임                                   |
| --------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| Nest      | controller, request validation, application orchestration, domain rule     | durable retry journal, event 보존                  |
| MongoDB   | 권위 있는 business state, transaction, idempotency evidence                | workflow timer, 서비스 간 fan-out                  |
| Restate   | durable command, workflow state, retry, timer, Saga와 compensation         | business record의 최종 원장, 일반 broadcast broker |
| Core NATS | 현재 접속한 소비자 대상 domain notification, pub/sub, fan-out, queue group | offline 소비자 보장, replay, exactly-once          |
| JetStream | 보존·ack·redelivery·replay가 명시적으로 필요한 event                       | 모든 내부 메시지의 무조건적인 기본 경로            |

Restate는 비결정적 작업을 `ctx.run`으로 감싸 결과를 journal에 보존하고 실패 시 재시도한다. 이 때문에 workflow와 compensation 책임에 잘 맞는다. [Restate durable steps](https://docs.restate.dev/develop/ts/durable-steps)

Core NATS는 저장과 ack가 없는 at-most-once 전송이다. subscriber가 publish 순간 offline이면 나중에 받을 수 없다. JetStream을 붙여야 persistence, consumer cursor, ack와 at-least-once redelivery가 생긴다. [Core NATS](https://docs.nats.io/learn/core-nats/), [JetStream](https://docs.nats.io/concepts/jetstream)

여기서 중요한 결론은 **Restate를 넣었다고 Core NATS event가 durable해지는 것은 아니라는 점**이다. Restate step이 publish 성공을 기록해도 그 순간 offline인 NATS subscriber에게 replay되지는 않는다. 또한 Mongo commit과 외부 publish 사이의 원자성이 자동으로 생기지도 않는다.

따라서 outbox 제거 여부는 event 종류로 결정해야 한다.

- 캐시 무효화, 실시간 UI 알림처럼 다음 상태 조회로 복구 가능한 event: Core NATS best-effort로 정의하고 outbox를 제거할 수 있다.
- 결제 완료 후 반드시 한 번 이상 처리해야 하는 notification·integration event: 현재 outbox/inbox를 유지하거나, JetStream과 idempotent consumer 또는 Restate가 소유하는 durable command 경로로 계약을 다시 설계해야 한다.

현재 purchase 경로는 publish lease 경쟁, ack 실패 뒤 재발행까지 테스트한다. 이 검증을 대체하지 않은 채 “기본 제외”라는 이유로 outbox를 지우는 데에는 반대한다.

## 5. MongoDB native 우선론과 현재 Mongoose 현실

Greenfield에서는 MongoDB 공식 driver 우선이 합리적이다. driver는 transaction, read/write concern과 change stream을 직접 제공하며, repository가 query와 document 변환을 명시적으로 소유하게 한다. [MongoDB Node driver transactions](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/), [change streams](https://www.mongodb.com/docs/drivers/node/current/monitoring-and-logging/change-streams/)

하지만 “공식 driver가 더 낮은 계층”이라는 사실만으로 현재 Mongoose를 제거할 이유는 되지 않는다. Mongoose schema는 document shape뿐 아니라 casting, index, method와 lifecycle middleware를 소유하고, Mongoose 자체도 MongoDB Node driver 위에서 동작한다. [Mongoose schema](https://mongoosejs.com/docs/guide.html), [Nest MongoDB integration](https://docs.nestjs.com/techniques/mongodb)

현재 저장소에서는 후속 지시에 따라 전면 전환을 진행하되, 다음 계약을 유지한다.

- repository 공개 API와 business assertion은 유지한다.
- Mongoose schema가 소유하던 shape·index·hook·casting 계약을 native driver 코드와 테스트로 명시한다.
- transaction session, read/write concern, duplicate/write-timeout error mapping을 누락하지 않는다.
- 전환 중 두 persistence 규약을 오래 병행하지 않고, 작업 경계에서 Mongoose 의존성과 공용 계층을 함께 제거한다.

이는 작은 adapter 교체가 아니라 persistence 계층 재구현이므로, 변화가 크다는 사실을 숨기지 않고 Vitest·Zod와 분리한 독립 단계로 다룬다.

## 6. 각 전환은 서로 독립된 작업이다

### Node 26과 Nest 12의 정확한 상태

Node 26은 2026-08-28 현재 Current이며 2026-10-28 Active LTS 전환 예정이다. 시드가 미래 기준선을 먼저 검증하는 선택은 가능하지만, 지금 “LTS”라고 부르면 안 된다. Node 프로젝트도 production에는 Active/Maintenance LTS를 권고한다. [Node release status](https://nodejs.org/en/about/previous-releases), [Node release schedule](https://github.com/nodejs/Release#release-schedule)

Nest 12 core package가 ESM-only인 것은 맞지만 애플리케이션 자체의 `type: module` 전환은 선택 사항이다. 현대 Node의 `require(esm)`을 통해 기존 CommonJS 앱도 Nest 12를 사용할 수 있으며, 공식 migration guide도 앱 module format을 자동으로 바꾸지 않는다. [Nest 12 ESM packages](https://docs.nestjs.com/migration-guide#esm-packages)

### ESM

적용했다. API·common·testing에 `type: module`과 TypeScript `nodenext`를 두고, 상대 import는 `.js`, API 계층 alias는 `#` package import로 명시했다. Rspack은 `ts-loader`의 번들러 전용 ESM emit과 Nest의 ESM output/externals를 유지하고, TSC 개발 emit·Vitest ESM 실행·Docker 실행을 각각 검증한다.

### pnpm

pnpm은 선언하지 않은 dependency 접근을 막고 `workspace:`가 외부 package로 잘못 해석되는 것을 거부하는 장점이 있다. [pnpm workspaces](https://pnpm.io/workspaces)

최초 검토 시점에는 npm도 workspace를 공식 지원하고 lockfile·workspace script·install 정책이 Docker와 CI에 연결되어 있어 보류했다. [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces/)

2026-08-29에는 후속 승인에 따라 그 전환 표면을 package-manager 전용 커밋으로 받아들였다. `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `workspace:*`와 pnpm 기준 scripts·CI·Docker로 옮겼고 ESM이나 test runner 변경은 포함하지 않았다. 이로써 “한 축씩 바꾸어 실패 원인을 분리한다”는 기준은 그대로 유지된다.

### Vitest

Greenfield ESM Nest 12에는 좋은 기본값이다. `@nestjs/testing`은 runner 중립이므로 특정 runner가 framework 의무는 아니다. 이행 전에는 공식 가이드가 기존 runner의 즉시 교체를 요구하지 않는다는 점을 근거로 동등성 검증을 선행했다. [Nest 12 testing stack](https://docs.nestjs.com/migration-guide#testing-stack)

전환 검증에서 다음 계약을 비교했고 API·common·testing 전체 적용으로 검증을 마쳤다.

1. global setup/teardown과 Testcontainers 종료
2. mock·fake timer·격리
3. import되지 않은 source까지 포함한 branches/functions/lines/statements 100%
4. source map과 실패 시 container 진단
5. 사람이 읽기 쉬운 tree reporter와 LCOV 결과

Vitest 4는 기본적으로 실행 중 load된 파일만 coverage에 넣으므로, 이행 전 `collectCoverageFrom` 계약을 유지하도록 `coverage.include`를 명시했다. TypeScript 6 `transpileModule` 변환으로 Nest decorator metadata와 source map을 보존하고, Vite의 Oxc와 SWC는 사용하지 않는다. [Vitest 4 migration](https://vitest.dev/guide/migration), [Vitest coverage](https://vitest.dev/guide/coverage.html)

global lifecycle, 실제 병렬 invocation 격리, mock·fake timer, 실패 진단과 100% coverage를 모두 통과해 Jest·ts-jest의 직접 의존성과 설정을 제거했다. 순수 JavaScript 계약·race·도구는 잘 맞는 `node:test`를 유지한다. devcontainer의 `firsttris.vscode-jest-runner` 확장은 runtime 의존성이 아니며, 제거에 리빌드가 필요해 사용자 승인 시점까지 보류한다.

### Zod와 Standard Schema

Nest 12는 route schema와 `StandardSchemaValidationPipe`를 추가했지만 기존 `ValidationPipe`와 class-validator 경로도 계속 지원한다. [Nest route schemas](https://docs.nestjs.com/migration-guide#route-decorator-schemas), [Nest validation](https://docs.nestjs.com/techniques/validation)

Zod + Standard Schema는 환경 설정과 request 경계를 나눠 적용한다. 환경 설정은 Joi의 coercion·default 계약을 테스트로 고정한 뒤 Zod로 옮기고 Joi를 제거했다. 다음 request 단계에서는 오류 응답·strict unknown·날짜와 숫자 변환 계약을 먼저 고정한 뒤 class-validator·class-transformer를 제거한다.

### Oxlint

Oxlint는 새 Nest 프로젝트의 기본이며 빠르다. 하지만 현재 ESLint는 일반 style 검사 외에 `eslint-plugin-boundaries`와 allowed-dependencies로 architecture를 강제한다. Oxlint의 외부 JS plugin 지원은 현재 alpha다. [Oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)

따라서 “빠른 lint를 하나 더” 추가하지 않는다. 기존 boundary 위반 fixture를 모두 같은 결과로 잡는 parity suite가 통과할 때만 ESLint를 대체한다.

### OpenTelemetry와 Nest Observe

이 부분은 제안안의 사실관계를 고쳐야 한다.

- `@nestjs/observe`는 OTel adapter가 아니다. HTTP·GraphQL·RPC·job trace와 runtime metrics를 Nest lifecycle에서 수집해 Nest Observe collector로 보내는 별도 APM SDK다. app key와 secret이 필요하다. [Nest Observe](https://docs.nestjs.com/observability/overview)
- OpenTelemetry의 공식 `@opentelemetry/instrumentation-nestjs-core`는 검토일 현재 지원 범위를 `@nestjs/core >=4 <12`로 명시한다. Nest 12 조합을 공식 지원한다고 가정하면 안 된다. [OTel Nest instrumentation](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-nestjs-core)

Nest 12의 native instrumentation hook과 Observe 지원은 “OTel native”라는 뜻이 아니다. 현재에는 둘 다 기본 설치하지 않는다. vendor-neutral export가 중요하면 OTel의 Nest 12 지원 또는 검증된 수동 계측 경로를 기다리고, 빠른 Nest 전용 APM이 중요하면 Observe의 데이터 반출·보존·비용 정책을 승인한 뒤 선택한다. 둘을 동시에 넣지 않는다.

## 7. 최종 권고안과 작업 순서

현재 저장소에서는 각 단계를 별도 커밋으로 진행한다.

1. ✅ Restate, Node 26, Nest 12, pnpm, Rspack + `ts-loader`, 백엔드 ESM을 순차 적용했다.
2. ✅ **Vitest로 전환했다.** SWC·Oxc 없이 Nest decorator metadata, lifecycle, mock, 미실행 파일 포함 100% coverage, 진단·결과 출력을 유지하고 Jest·ts-jest를 함께 제거했다. devcontainer 확장 제거만 리빌드 승인 때까지 보류한다.
3. **Zod + Standard Schema로 전환한다.** env 검증과 Joi 제거는 완료했다. 다음으로 request 검증을 옮기고 class-validator·class-transformer를 제거한다.
4. **MongoDB 공식 driver로 전환한다.** Mongoose가 담던 schema·index·hook·CAS·transaction 계약을 repository 구현과 테스트로 재구현하고 Mongoose 계층을 제거한다.
5. **나머지는 명확한 trigger가 있을 때만 하나씩 검토한다.** architecture rule parity가 되면 Oxlint, backend와 데이터 정책이 정해지면 OTel 또는 Observe를 선택한다.

결론적으로 제안안의 책임 분리와 기술 방향을 채택하되, 검증 강도를 낮추거나 여러 축을 한 커밋에 섞지 않는다. 큰 변화도 필요하면 수용하지만, 동일 실패를 계속 잡는지를 단계별 전체 검증으로 확인한다.
