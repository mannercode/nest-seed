# NestJS 시드 프로젝트 전체 검토

검토일: 2026-09-04. 기준은 `9e1804c`에 기존 미커밋 변경을 포함한 작업 트리다. README와 `docs/` 전체를 먼저 읽고 앱·공유 라이브러리·테스트·인프라·개발 도구·CI를 검토했다. 기존 수정과 TODO는 보존했다.

**분산 협력까지 보여 주는 NestJS 시드라는 목적에는 대체로 적절하다. 우선 개선할 것은 도구 수나 코드량보다, 예제가 약속하는 실패·입력·검증 계약의 정확성이다.** 단순 CRUD만 필요한 프로젝트에는 도입 비용이 크지만, 이것을 근거로 이 저장소의 목적을 바꿀 이유는 없다.

다음 선택은 유지할 근거가 충분하다.

- SoLA 모듈 경계, 단일 Core를 직접 사용하는 Gateway, 조합이 필요한 곳의 Application/View.
- MongoDB 원자 전이·transaction·CAS와 Redis 락의 역할 구분.
- Restate, Core NATS, outbox·JetStream으로 서로 다른 전달·복구 보장을 보여 주는 예제.
- 실제 인프라, 100% 커버리지 게이트, 반복 CI, Dev Container 단일 개발 경로.
- 최소 Next.js 데모와 개발용 결제·알림 구현. 실제 provider, 운영 HA·TLS·관측 backend가 없는 것은 명시된 시드 범위에 부합한다.

P1은 데이터 정합성·복구 예제를 가져다 쓰기 전에 우선 해결할 문제, P2는 정상적인 사용 또는 검증의 신뢰성을 해치는 문제, P3는 설명·유지보수 개선이다. 코드로 확인한 경로와 실제로 실행한 재현은 구분했다.

## 우선 개선 사항

### 1. P1 · 영화·극장 삭제와 상영 생성의 직렬화 경계가 없다 — 기존 미해결

[삭제 서비스](../apps/api/src/services/application/catalog-management/catalog-management.service.ts#L12)는 참조 조회와 부모 삭제를 나눠 실행한다. [상영 생성 transaction](../apps/api/src/services/application/showtime-creation/internal/showtime-creation-persistence.service.ts#L43)은 삭제와 같은 조건을 함께 확정하지 않는다. 참조 확인 직후 생성이 끼어들면 두 요청이 모두 성공해 삭제된 부모를 참조하는 상영·티켓이 남을 수 있다.

상세 경합과 S3 정리의 결정 사항은 [기존 TODO](catalog-deletion-showtime-creation-race.md)가 이미 소유한다. 현재 코드에서도 해결되지 않았다. 같은 부모의 생성·삭제가 공통 직렬화 지점을 거치게 하고, 승자에 따라 생성 거부 또는 삭제 거부가 결정되는 기존 불변식을 검증해야 한다. Application으로 이동하거나 Redis 락만 추가하는 것으로 완료 처리하면 안 된다.

### 2. P1 · NATS 진행 알림의 실패가 상영 생성과 결과 반환을 막는다

[workflow](../apps/api/src/services/application/showtime-creation/worker/workflow.ts#L50)는 `waiting`·`processing` 발행을 마쳐야 DB 작업을 시작한다. DB 커밋 후에도 `succeeded` 발행을 마쳐야 업무 결과를 반환한다. 발행 재시도에는 상한이 있으며 소진 시 `TerminalError`가 발생한다. [Restate durable step 계약](https://docs.restate.dev/develop/ts/durable-steps)

따라서 NATS 장애가 초기 발행에서 지속되면 생성이 시작되지 않고, 마지막 발행에서 지속되면 **DB에는 생성됐지만 workflow 결과 조회는 실패**할 수 있다. [문서의 best-effort 알림·상태 재조회 설명](../docs/apps.md#L100)과 다르다. 현재 [workflow 테스트](../apps/api/src/services/application/showtime-creation/worker/__tests__/workflow.spec.ts#L131)는 발행 timeout의 전파만 확인한다.

추천은 업무 결과의 확정·조회와 알림 성공을 분리하는 것이다. 알림을 필수 단계로 유지하려면 그 의존성과 실패 결과를 계약에 명시해야 한다. 기존 테스트에서 초기 발행 실패와 DB 커밋 후 발행 실패를 각각 주입해 종결 상태와 실제 생성 건수를 확인한다. 이 장애 시나리오는 이번 검토에서 실제 NATS에 주입하지 않았다.

### 3. P1 · 업로드 완료의 부분 실패를 재시도하면 이미 소유된 파일을 삭제할 수 있다

[영화의 finalize](../apps/api/src/services/core/movies/movies.service.ts#L146)는 asset 소유 부여 후 영화에 연결한다. 연결이 실패해도 pending 기록을 남겨 재시도할 수 있다는 주석이 있다. 그러나 재시도가 업로드 만료 시각 이후면 [assignOwner](../apps/api/src/services/infrastructure/assets/assets.repository.ts#L27)의 생성 시각 조건이 실패하고, [AssetsService](../apps/api/src/services/infrastructure/assets/assets.service.ts#L114)는 이미 owner가 있는 asset까지 S3·DB에서 삭제한다.

재현 조건은 `소유 부여 성공 → addAsset 실패 → 업로드 만료 → 같은 finalize 재시도`다. [기존 테스트](../apps/api/src/__tests__/core/movies-assets.spec.ts#L230)는 정상 완료 후 재호출·동시 호출만 다룬다. 소유된 asset은 만료 후에도 유지하는 [cleanup 테스트](../apps/api/src/__tests__/infrastructure/assets.spec.ts#L345)와도 수명주기가 맞지 않는다.

동일 owner에 대한 완료 재시도와 최초 업로드 만료를 구분하고, 만료 삭제의 조건을 미소유 상태와 함께 확정하는 것이 최소 개선 방향이다. 기존 테스트에 연결 단계의 단발 실패와 시간 제어를 넣어 S3 객체·영화 연결이 보존되는지 확인한다. 정적 경로를 교차 검토했으며 실제 파일 삭제 재현은 수행하지 않았다.

### 4. P2 · 요청에서 허용한 입력이 저장소에서 거부되어 500이 된다

[User PATCH DTO](../apps/api/src/services/core/users/dtos/update-user.dto.ts#L4)는 `null`을 허용하지만 [저장소](../apps/api/src/services/core/users/users.repository.ts#L108)의 `UserWriteSchema.partial()`은 거부한다. admin·theater에도 같은 불일치가 있다. movie의 nullable upsert도 [저장 모델 검증](../apps/api/src/services/core/movies/movies.repository.ts#L134)과 맞지 않는다.

예를 들어 `PATCH /users/me {"name":null}`은 입력 검증을 통과한 뒤 Zod 오류로 실패한다. 실제 user/admin 스키마 소스를 메모리에서 실행해 `{name:null}`, `{password:null}` 네 경우의 요청 검증 성공·저장 검증 실패를 확인했다. HTTP 500 전파는 코드로 확인했다.

공개된 영화에 `{"genres":[]}`를 보내는 경우도 도메인상 예상 가능한 실패인데 일반 `Error`가 발생한다. [테스트](../apps/api/src/__tests__/core/movies-publish.spec.ts#L114)는 서비스 예외만 확인해 HTTP 계약을 놓친다. null의 의미를 먼저 정한 뒤 요청·저장 타입을 맞추고, 공개 상태 불변식 위반은 명시적인 도메인 오류와 4xx로 표현해야 한다. 기존 HTTP 테스트에서 응답과 DB 불변을 함께 확인한다.

JSON body가 boolean을 문자열·숫자로 바꾸는 문제는 [이전 검토](repository-simplification-review.md)의 미결 항목으로 여전히 남아 있다. 이것은 위 null 불일치와 별개이며, query 변환까지 일괄 제거할 이유는 없다.

### 5. P2 · 상영 결과와 멱등 접수 기록의 보존 수명이 다르다

[workflowRetention](../apps/api/src/services/application/showtime-creation/worker/workflow.ts#L113)은 완료 후 1시간이다. [상태 조회](../apps/api/src/services/application/showtime-creation/worker/restate-workflow-client.service.ts#L48)는 Restate 출력만 사용하지만, [접수 기록](../apps/api/src/services/application/showtime-creation/internal/showtime-creation-submission.repository.ts#L75)은 만료 없이 기존 `accepted`와 sagaId를 반환한다. Restate 완료 실행에는 보존·정리 수명이 있다. [Restate 보존 정책](https://docs.restate.dev/services/configuration)

출력이 정리된 뒤 같은 키를 보내도 기존 sagaId만 받고, API에는 그 결과를 다시 얻거나 만료를 설명하는 계약이 없다. MongoDB operation에 결과가 남아 있어도 현재 상태 조회는 이를 사용하지 않는다.

시드에서도 결과 조회의 보존 기간과 만료 응답은 명확해야 한다. 추천은 종결 결과의 소유권을 정해 접수·조회 수명을 맞추는 것이다. 1시간 보존을 유지하는 선택도 가능하지만, 그 경우 만료 후 응답과 같은 키의 재요청 의미를 명시해야 한다. 단순 timeout 확대나 자동 재실행으로 덮지 않는다. 실제 보존 만료는 재현하지 않았으며, 현재 테스트는 즉시 조회의 ready/pending만 다룬다.

### 6. P2 · 미공개 영화의 공개 조회 정책이 경로마다 다르다

`GET /movies/:id`는 draft를 404로 숨기지만, [추천](../apps/api/src/services/application/recommendation/recommendation.service.ts#L23)은 미래 상영의 영화 ID를 `getMany`로 읽어 공개 여부 없이 반환한다. [상영 생성 검증](../apps/api/src/services/application/showtime-creation/internal/showtime-bulk-validator.service.ts#L112)도 영화의 존재만 확인하므로 admin이 draft에 상영을 만드는 입력은 차단하지 않는다. 결과는 익명 접근 가능한 [홈 API](../apps/api/src/services/gateway/user-home-view.http-controller.ts#L11)의 `recommendedMovies`에 들어갈 수 있다.

미공개 영화도 과거 관람 기록 계산에 쓰는 내부 조회와, 사용자에게 추천하는 후보 조회의 정책을 구분할 필요가 있다. 추천 후보는 공개작으로 제한하는 방향을 추천하며, draft 상영 생성 자체를 금지할지는 별도 결정이다. 기존 테스트에서 draft에 미래 상영을 만든 뒤 공개 단건·목록·홈의 정책이 일치하는지 확인한다. 이번에는 정적 경로를 확인했다.

### 7. P2 · race가 같은 자원의 복제본 간 경쟁을 증명하지 못하는 경우가 있다

[가입 race](../tests/api/race/user-signup-race.js#L26)는 전체 이메일 그룹의 복제본 집합만 검사한다. 각 이메일의 경쟁 요청은 한 프로세스에만 보내고 이메일마다 다른 프로세스를 사용해도 통과한다. JWT·선점·구매 race에도 합산 검사가 있다. [상영 overlap race](../tests/api/race/showtime-overlap-race.js#L84)는 복제본 검사 자체가 없다.

실제 검증 함수를 VM에서 실행한 반례는 다음과 같다. 운영 API 경합 재현이 아니라 **테스트 판정 로직의 반례**다.

- 이메일 A의 요청은 api-0만, 이메일 B의 요청은 api-1만 사용했는데 `groups:2, total:4, replicas:2`로 통과했다.
- 상영 접수 응답 모두 api-only였는데 `succeeded:1, failed:1`로 통과했다.

자원 그룹별 분산을 확인해야 한다. 비동기 상영은 HTTP 접수 복제본과 실제 Restate 실행 복제본이 다르므로 실행 지점의 관측 방법도 정해야 한다. 상영·티켓의 최종 상태를 조회해 SSE 건수와 대조하는 검증도 필요하다. 반복 횟수를 늘리는 것만으로 이 빈틈이 해결되지는 않는다.

### 8. P2 · chaos와 일부 구매 race가 무관한 실패 응답을 정상으로 센다

[chaos](../tests/api/race/replica-chaos.js#L45)는 매번 새로운 이메일로 가입하지만 [오류율](../tests/api/race/replica-chaos.js#L125)은 전송 오류·5xx만 센다. 모든 요청이 403·404·429여도 네 복제본 헤더가 있으면 오류율 0%로 복구 조건을 만족할 수 있다. [구매 overlap](../tests/api/race/purchase-overlap-race.js#L29)도 모든 4xx를 정상 패자로 인정한다.

chaos는 기대한 201과 예상하지 않은 응답을 구분하고, 구매는 실제 도메인 충돌에 해당하는 상태·오류 코드만 정상 패자로 인정해야 한다. 기존 검증기에 403/429를 넣었을 때 실패하는지 확인하면 된다. 관측 가능한 실패를 정확히 세는 개선이며 임계치 변경은 필요하지 않다.

### 9. P2 · MongoDB readiness가 majority 확인 실패를 놓친다

[준비 probe](../infra/compose.mongo.yml#L84)는 `runCommand`의 `ok`만 확인한다. generic command는 `{ok:1, writeConcernError:...}`를 반환할 수 있고, write concern 오류를 자동 예외로 바꾸지 않는다. 따라서 복제가 정체되어 majority 확인이 timeout이어도 준비 완료로 판정할 수 있다. [MongoDB 공식 명세](https://github.com/mongodb/specifications/blob/master/source/read-write-concern/read-write-concern.md#errors)

`writeConcernError`·`writeErrors`·삽입 결과를 확인하거나 해당 실패를 예외로 전달하는 쓰기 helper를 사용한다. 기존 readiness 대기 경계에서 해결하고 sleep을 늘리지 않는다. 공식 프로토콜과 코드를 대조했으며 실제 replica 장애는 주입하지 않았다.

### 10. P2 · S3 테스트 정리가 객체별 삭제 실패를 성공 처리한다

[emptyBucket](../tools/vitest-helpers/index.js#L53)은 `DeleteObjectsCommand` 응답을 버린다. S3는 HTTP 200에도 객체별 실패를 `Errors`로 반환한다. [AWS DeleteObjects 계약](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObjects.html)

실제 함수에 `Errors:[{Code:'InternalError',...}]`를 반환하는 client를 주입했을 때 정상 resolve함을 확인했다. 실제 S3 장애를 일으킨 것은 아니다. [afterEach](../tools/vitest-helpers/index.js#L130)가 이 함수를 사용하므로 다음 테스트로 객체가 남거나 최종 bucket 삭제에서 늦게 실패할 수 있다. 응답의 실패 key/code를 확인해 정리 실패로 전달하는 것으로 개선할 수 있다.

### 11. P2 · 포크 후 env 값을 바꾸면 실행 경로마다 다르게 해석된다

[환경 문서](../docs/reference/environment.md#L20)는 Docker `--env-file`의 literal 규칙을 안내한다. 그러나 같은 `.env.infra`를 [reset](../infra/reset.sh#L8)과 [API 실행기](../tests/api/runner.sh#L13)는 Bash로 실행하고, [Compose](../tests/api/compose.yml#L2)는 env_file로 해석한다.

`VALUE=Dev$word`는 Docker에서는 문자 그대로지만 `set -u` Bash에서는 `word: unbound variable`로 실패한다. 이 Bash 동작은 임시 값으로 실행 확인했다. 공백이 있는 이름·따옴표도 소비 경로에 따라 달라진다. 현재 커밋된 단순 값에서 문제가 없다는 사실이 포크 후 재현성을 보장하지 않는다.

같은 파일의 값 해석을 통일하고 환경 문서에 실제 소비 경계를 반영해야 한다. literal 계약을 유지한다면 shell source부터 바꿔야 하며, Compose의 [raw 형식](https://docs.docker.com/reference/compose-file/services/#env_file)만 적용해서는 전체 문제가 해결되지 않는다.

## 추가로 정할 것과 작은 개선

| 항목                    | 판단과 추천                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 인증의 복잡성           | [이전 검토의 인증 간소화안](repository-simplification-review.md)은 아직 결정 사항이다. 즉시 철회·refresh 재사용 탐지·동시 회전 계약을 유지할지 먼저 정해야 한다. 코드량을 근거로 보장을 임의로 삭제하지 않는다.                                                                                                                              |
| bcrypt 입력 한계        | user/admin의 비밀번호 DTO에 길이 상한이 없다. 설치된 bcrypt로 같은 72-byte 접두어를 가진 서로 다른 77/78-byte 입력이 동일하게 검증됨을 확인했다. 현재 해시 방식의 byte 한계를 입력 계약에 반영할지 결정할 필요가 있다. 이 검토에서 새 검증이나 해시 의존성을 추가하지 않았다.                                                                |
| BFF의 upstream 오류, P3 | [console](../apps/console/src/app/api/%5B...path%5D/route.ts#L88)·[user-app](../apps/user-app/src/app/api/%5B...path%5D/route.ts#L88)의 최초 `callApi`만 catch 밖에 있다. 같은 네트워크 실패를 logout·refresh·재요청은 JSON 502로 표현한다. 최초 호출에도 기존 오류 계약을 적용하는 개선을 권한다. 실제 Next.js 장애 응답은 재현하지 않았다. |
| 도구 lint 범위, P3      | `tools/dev-tools`에는 lint script가 없고 루트 lint도 `vitest.config.base.mjs` 등을 Oxlint에 전달하지 않는다. 커밋 훅과 CI의 검사 범위가 다르다. 기존 lint 진입점에 누락 파일을 포함하면 된다. 직접 검사한 대표 누락 파일에는 현재 오류가 없었다.                                                                                             |

## 문서 자체의 개선

문서와 구현 중 어느 쪽을 채택할지는 이 검토에서 임의로 수정하지 않았다. 특히 아래 항목은 시드 사용자가 경계를 배우는 데 직접 영향을 준다.

| 문서                                                                       | 개선점                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [apps의 HTTP 경계](../docs/apps.md#L25), [에러 규칙](../docs/apps.md#L112) | “도메인이 HTTP에 결합되지 않는다”, “Gateway가 상태로 번역한다”는 설명과 달리 Core/Application이 Nest HTTP 예외를 직접 던진다. 시드의 작은 구현을 유지한다면 실제 결합을 인정하도록 설명을 좁히는 쪽을 추천한다. 완전한 분리를 요구한다면 별도 설계 변경이다.                  |
| [apps의 SSE·상태 조회](../docs/apps.md#L100)                               | 2·5번의 필수 알림 의존성과 결과 보존 수명을 반영해야 한다. 코드에 있는 숫자를 복제하기보다 언제까지 무엇을 조회할 수 있는지 계약을 설명한다.                                                                                                                                  |
| [tests의 복제본 종료 보장](../docs/tests.md#L15)                           | chaos는 가입 중 API를 종료하고, Restate 복구 검사는 별도 counter workflow의 Restate 서버를 종료한다. 실제 구매·상영을 실행 중인 API owner가 죽어 다른 API가 인계하는 전체 경로까지 직접 검증한다고 읽히지 않게 구분한다. 기존 테스트 확장 후보로 남길 만하다.                 |
| [실행 가능한 API 문서](../docs/apps.md#L175)                               | `TEST`는 기본적으로 상태 코드를 비교한다. [최초 구매 응답 재현 항목](../apps/api/api-docs/purchases.spec#L31)은 본문 동일성까지 검사하지 않는다. 주요 계약에는 기존 spec에서 본문 단언을 추가하거나 제목의 검증 범위를 좁힌다. 앱 통합 테스트에는 별도 멱등 응답 검증이 있다. |
| [README 시작 안내](../README.md#L20)                                       | 지원 경로인 Remote SSH와 브라우저 접속에 필요한 포트 전달·기존 tunnel 안내를 시작 단계에 연결한다. 자동 포트 공개나 별도 개발 환경 지원을 추가할 필요는 없다.                                                                                                                 |
| [개발 규칙의 clean](../docs/reference/conventions.md#L23)                  | 현재 `clean` 명령·허용 목록 구현이 없는데 symlink 거부 등을 현재 보장처럼 설명한다. 미래 규칙인지 표시하거나 불필요해진 문장을 제거한다.                                                                                                                                      |
| 기존 `_todo/`                                                              | 단순화 검토의 앞부분에는 뒤에서 철회한 의견과 과거 “처리 결과”가 함께 남아 있다. 이후 정리 시 미결 항목을 앞에 모으고, 승인·철회·완료 상태를 명확히 하면 재검토 때 같은 제안을 반복하는 일을 줄일 수 있다.                                                                    |

포크 안내에는 도구 목록을 더 늘리기보다 **기본 CRUD → Core 조합 → durable workflow·구매 복구**의 읽기 순서와 각 예제를 새 도메인으로 교체할 때 유지할 불변식을 짧게 연결하면 좋다. README의 현재 읽기 순서가 좋은 출발점이다.

## 검증과 범위

- `pnpm run lint` 통과: 타입·코드·format·문서 링크·shell 검사. 이 명령의 기존 검사 범위 안에서의 결과다.
- `pnpm run test` 통과: testing 28개, common 514개, API 440개, 합계 **982개 / 81개 파일**. common·API의 수집 대상 커버리지는 statement·branch·function·line 모두 100%다.
- 추가 실행: 실제 DTO의 null 처리, bcrypt 입력 한계, race 판정의 반례, S3 정리의 객체별 실패 응답, Bash env 해석. 저장소에 새 테스트 파일을 만들지 않고 메모리·stdin에서 확인했다.
- AtoZ·브라우저 E2E·실제 다중 복제본 race·benchmark는 실행하지 않았다. 검토 문서 작성 범위에서 기본 검사와 위 반례 검증을 수행했으며, `atoz`의 인프라 volume reset이나 별도 스택 장애 주입까지 진행하지 않았다. 외부 provider·운영 배포의 적합성을 인증하는 검토도 아니다.

개선 순서는 **P1 정합성·복구 경계 → 입력·조회 계약 → 검증기의 거짓 성공 제거 → env 재현성·문서 정합성 → 합의된 인증 간소화**를 추천한다. 기능 수정과 새 테스트 파일 작성은 이번 검토에 포함하지 않았다.
