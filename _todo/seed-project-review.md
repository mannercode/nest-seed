# NestJS 시드 프로젝트 전체 검토

검토일: 2026-09-04. 기준은 `9e1804c`에 기존 미커밋 변경을 포함한 작업 트리다. README와 `docs/` 전체를 먼저 읽고 앱·공유 라이브러리·테스트·인프라·개발 도구·CI를 검토했다. 기존 수정과 TODO는 보존했다.

**분산 협력까지 보여 주는 NestJS 시드라는 목적에는 대체로 적절하다. 우선 개선할 것은 도구 수나 코드량보다, 예제가 약속하는 실패·입력·검증 계약의 정확성이다.** 단순 CRUD만 필요한 프로젝트에는 도입 비용이 크지만, 이것을 근거로 이 저장소의 목적을 바꿀 이유는 없다.

다음 선택은 유지할 근거가 충분하다.

- SoLA 모듈 경계, 단일 Core를 직접 사용하는 Gateway, 조합이 필요한 곳의 Application/View.
- MongoDB 원자 전이·transaction·CAS와 Redis 락의 역할 구분.
- Restate, Core NATS, outbox·JetStream으로 서로 다른 전달·복구 보장을 보여 주는 예제.
- 실제 인프라, 100% 커버리지 게이트, 반복 CI, Dev Container 단일 개발 경로.
- 최소 Next.js 데모와 개발용 결제·알림 구현. 실제 provider, 운영 HA·TLS·관측 backend가 없는 것은 명시된 시드 범위에 부합한다.
- NestJS HTTP 예외를 프로젝트 공통 오류로 사용한다. 이미 정의된 오류 분류를 Core·Application에서도 직접 재사용하는 의도된 선택이다. 별도 도메인 예외 계층이나 Gateway 변환 계층을 추가하지 않는다.

판단 단위는 영화 예매 서비스 전체의 완성도가 아니라 **각 기능이 보여 주려는 기술과 그 핵심 보장**이다. 좌석 선점은 원자적 경쟁, 구매는 멱등성·부분 실패, 상영 생성은 durable 실행을 보여 주면 된다. 실제 영화관의 모든 운영 규칙과 기능 조합을 구현할 필요는 없다. 새 규칙이나 복구 장치를 제안할 때는 기존 예제에서 무엇을 더 배우게 되는지 먼저 따져야 한다.

다만 선택한 예제 안에서는 설명·구현·테스트가 일치해야 한다. 재시도 예제가 이미 완료한 효과를 훼손하거나, 경쟁 테스트가 경쟁하지 않은 실행을 통과시키는 문제는 시드에서도 고칠 가치가 있다. 반면 부모 삭제의 동시 정합성, 미공개 영화의 추천 정책, 결과의 장기 보존은 지원 범위를 먼저 정할 항목이다. 범위를 좁히기로 결정한다면 코드·문서·테스트의 계약을 함께 조정해야 한다.

P1은 선택한 기술 예제의 정합성·복구 보장을 해치는 문제, P2는 입력·검증·실행 재현성 문제, P3는 설명·유지보수 개선이다. 코드로 확인한 경로와 실제로 실행한 재현도 구분했다.

**결정 방법:** 각 번호의 **제안**에 Yes/No로 답하면 된다. Yes는 적힌 범위와 동작 변화를 채택한다는 뜻이고, No는 해당 제안을 보류한다는 뜻이다. 1·12·16번처럼 보류·현행 유지를 추천한 항목도 승인할 내용이 명시돼 있다. 4번은 서로 다른 변경이므로 4a·4b·4c로 나눴다. 검증은 기존 테스트 파일을 보완하는 범위이며, 새 테스트 파일이나 명시하지 않은 설계 확대는 포함하지 않는다.

HTTP 예외 사용은 이미 확정된 선택이다. 해당 비판은 철회하고 [apps의 계층 경계](../docs/apps.md#1-sola-5계층)와 [공통 에러 규칙](../docs/apps.md#32-에러-규칙)에 반영했다. 나머지는 아래의 승인 전 제안이다.

## 발견 사항과 적용 범위

### 1. 범위 결정 · 영화·극장 삭제와 상영 생성의 직렬화 경계가 없다 — 기존 미해결

[삭제 서비스](../apps/api/src/services/application/catalog-management/catalog-management.service.ts#L12)는 참조 조회와 부모 삭제를 나눠 실행한다. [상영 생성 transaction](../apps/api/src/services/application/showtime-creation/internal/showtime-creation-persistence.service.ts#L43)은 삭제와 같은 조건을 함께 확정하지 않는다. 참조 확인 직후 생성이 끼어들면 두 요청이 모두 성공해 삭제된 부모를 참조하는 상영·티켓이 남을 수 있다.

상세 경합과 S3 정리의 결정 사항은 [기존 TODO](catalog-deletion-showtime-creation-race.md)가 이미 소유한다. 현재 코드에서도 해결되지 않았다.

**제안 1 — 삭제 경합 해결은 보류하고, 삭제를 순차 실행하는 CRUD 예제로 한정한다.** `docs/apps.md`에 부모 삭제와 상영 생성·업로드의 동시 실행은 현재 보장하지 않는다고 명시하고, 기존 TODO는 미해결로 유지한다. 삭제 API와 순차 참조 검사는 유지한다. 상영 간 경쟁의 CAS·transaction 예제와 겹치는 추가 조율을 줄이기 위한 추천이다. 대가는 동시 삭제의 정합성을 보장하지 않는다는 것이며, 운영에 그대로 적용할 수 없다. 통합 삭제 workflow·S3 복구 체계는 추가하지 않는다.

### 2. P1 · NATS 진행 알림의 실패가 상영 생성과 결과 반환을 막는다

[workflow](../apps/api/src/services/application/showtime-creation/worker/workflow.ts#L50)는 `waiting`·`processing` 발행을 마쳐야 DB 작업을 시작한다. DB 커밋 후에도 `succeeded` 발행을 마쳐야 업무 결과를 반환한다. 발행 재시도에는 상한이 있으며 소진 시 `TerminalError`가 발생한다. [Restate durable step 계약](https://docs.restate.dev/develop/ts/durable-steps)

따라서 NATS 장애가 초기 발행에서 지속되면 생성이 시작되지 않고, 마지막 발행에서 지속되면 **DB에는 생성됐지만 workflow 결과 조회는 실패**할 수 있다. [문서의 best-effort 알림·상태 재조회 설명](../docs/apps.md#L100)과 다르다. 현재 [workflow 테스트](../apps/api/src/services/application/showtime-creation/worker/__tests__/workflow.spec.ts#L131)는 발행 timeout의 전파만 확인한다.

**제안 2 — 상태 발행의 재시도를 소진해도 발행 실패를 기록하고 업무 실행·결과 반환을 계속한다.** 이 처리는 알림 단계에만 적용하고 workflow 취소와 DB 오류는 기존 실패 경로로 전달한다. SSE는 누락될 수 있지만 상태 API로 실제 종결 결과를 확인하는 계약으로 맞춘다. 별도 outbox는 추가하지 않는다. 기존 테스트에서 초기 발행 실패와 DB 커밋 후 발행 실패를 각각 주입해 종결 상태와 실제 생성 건수를 확인한다. 이 장애 시나리오는 이번 검토에서 실제 NATS에 주입하지 않았다.

### 3. P1 · 업로드 완료의 부분 실패를 재시도하면 이미 소유된 파일을 삭제할 수 있다

[영화의 finalize](../apps/api/src/services/core/movies/movies.service.ts#L146)는 asset 소유 부여 후 영화에 연결한다. 연결이 실패해도 pending 기록을 남겨 재시도할 수 있다는 주석이 있다. 그러나 재시도가 업로드 만료 시각 이후면 [assignOwner](../apps/api/src/services/infrastructure/assets/assets.repository.ts#L27)의 생성 시각 조건이 실패하고, [AssetsService](../apps/api/src/services/infrastructure/assets/assets.service.ts#L114)는 이미 owner가 있는 asset까지 S3·DB에서 삭제한다.

재현 조건은 `소유 부여 성공 → addAsset 실패 → 업로드 만료 → 같은 finalize 재시도`다. [기존 테스트](../apps/api/src/__tests__/core/movies-assets.spec.ts#L230)는 정상 완료 후 재호출·동시 호출만 다룬다. 소유된 asset은 만료 후에도 유지하는 [cleanup 테스트](../apps/api/src/__tests__/infrastructure/assets.spec.ts#L345)와도 수명주기가 맞지 않는다.

**제안 3 — 동일 owner에 대한 finalize는 최초 업로드 만료와 무관하게 성공시켜 영화 연결을 재시도한다.** 다른 owner로 변경하려는 요청은 `ConflictException`으로 거절하고, 만료 삭제는 미소유 자산인 경우에만 허용한다. 기존 테스트에 연결 단계의 단발 실패와 시간 제어를 넣어 S3 객체·영화 연결이 보존되는지 확인한다. 현재 완료 재시도의 상태 판정만 고치며 범용 파일 복구 workflow는 추가하지 않는다. 정적 경로를 교차 검토했으며 실제 파일 삭제 재현은 수행하지 않았다.

### 4. P2 · 요청에서 허용한 입력이 저장소에서 거부되어 500이 된다

[User PATCH DTO](../apps/api/src/services/core/users/dtos/update-user.dto.ts#L4)는 `null`을 허용하지만 [저장소](../apps/api/src/services/core/users/users.repository.ts#L108)의 `UserWriteSchema.partial()`은 거부한다. admin·theater에도 같은 불일치가 있다. movie의 nullable upsert도 [저장 모델 검증](../apps/api/src/services/core/movies/movies.repository.ts#L134)과 맞지 않는다.

예를 들어 `PATCH /users/me {"name":null}`은 입력 검증을 통과한 뒤 Zod 오류로 실패한다. 실제 user/admin 스키마 소스를 메모리에서 실행해 `{name:null}`, `{password:null}` 네 경우의 요청 검증 성공·저장 검증 실패를 확인했다. HTTP 500 전파는 코드로 확인했다.

공개된 영화에 `{"genres":[]}`를 보내는 경우도 도메인상 예상 가능한 실패인데 일반 `Error`가 발생한다. [테스트](../apps/api/src/__tests__/core/movies-publish.spec.ts#L114)는 서비스 예외만 확인해 HTTP 계약을 놓친다.

JSON body가 boolean을 문자열·숫자로 바꾸는 문제는 [이전 검토](repository-simplification-review.md)의 미결 항목으로 여전히 남아 있다. 이것은 위 null 불일치와 별개이며, query 변환까지 일괄 제거할 이유는 없다.

- **제안 4a — 저장 모델이 null을 허용하지 않는 필드는 요청에서도 null을 400으로 거절한다.** PATCH의 필드 생략은 허용하며, 생략한 값은 유지한다. user·admin·theater·movie 요청 스키마와 기존 HTTP 테스트를 맞춘다.
- **제안 4b — 공개 영화의 기존 필수값 규칙을 위반하는 수정은 422로 거절한다.** 규칙을 판정하는 곳에서 `UnprocessableEntityException`과 `MovieErrors` payload를 사용하고 DB가 바뀌지 않음을 검증한다. 새 영화관 업무 규칙은 추가하지 않는다.
- **제안 4c — JSON body는 선언된 문자열·숫자 타입을 그대로 요구한다.** `password:true`, `durationInMinutes:true` 등의 암시적 변환을 제거해 400으로 거절한다. query의 숫자 문자열과 날짜 문자열처럼 전송 형식상 필요한 변환은 유지한다. 기존에 암시적 변환에 의존하던 클라이언트는 올바른 JSON 타입을 보내야 한다.

### 5. 범위 결정 · 상영 결과와 멱등 접수 기록의 보존 수명이 다르다

[workflowRetention](../apps/api/src/services/application/showtime-creation/worker/workflow.ts#L113)은 완료 후 1시간이다. [상태 조회](../apps/api/src/services/application/showtime-creation/worker/restate-workflow-client.service.ts#L48)는 Restate 출력만 사용하지만, [접수 기록](../apps/api/src/services/application/showtime-creation/internal/showtime-creation-submission.repository.ts#L75)은 만료 없이 기존 `accepted`와 sagaId를 반환한다. Restate 완료 실행에는 보존·정리 수명이 있다. [Restate 보존 정책](https://docs.restate.dev/services/configuration)

출력이 정리된 뒤 같은 키를 보내도 기존 sagaId만 받고, API에는 그 결과를 다시 얻거나 만료를 설명하는 계약이 없다. MongoDB operation에 결과가 남아 있어도 현재 상태 조회는 이를 사용하지 않는다.

**제안 5 — 완료 후 1시간 보존을 유지하고, 접수 기록은 있지만 Restate 출력이 더 이상 없으면 상태 조회를 410 Gone으로 응답한다.** 접수 기록 자체가 없으면 기존 404를 유지한다. 같은 키·같은 본문의 POST는 계속 기존 sagaId를 202로 반환하며 재실행하지 않는다. Restate 연결 실패를 결과 소멸로 취급하지 않는다. 짧은 보존 기간의 비용과 한계를 드러내는 예제로 두고, 영구 결과 저장·자동 재실행은 추가하지 않는다. 상태 조회·중복 요청의 기존 테스트와 문서에 이 계약을 반영한다. 실제 보존 만료는 이번 검토에서 재현하지 않았다.

### 6. 범위 결정 · 미공개 영화의 공개 조회 정책이 경로마다 다르다

`GET /movies/:id`는 draft를 404로 숨기지만, [추천](../apps/api/src/services/application/recommendation/recommendation.service.ts#L23)은 미래 상영의 영화 ID를 `getMany`로 읽어 공개 여부 없이 반환한다. [상영 생성 검증](../apps/api/src/services/application/showtime-creation/internal/showtime-bulk-validator.service.ts#L112)도 영화의 존재만 확인하므로 admin이 draft에 상영을 만드는 입력은 차단하지 않는다. 결과는 익명 접근 가능한 [홈 API](../apps/api/src/services/gateway/user-home-view.http-controller.ts#L11)의 `recommendedMovies`에 들어갈 수 있다.

**제안 6 — 사용자에게 반환하는 추천 후보를 공개 영화로 한정한다.** 공개 목록·단건 조회와 하나의 단순한 규칙을 공유하는 편이 예제를 이해하기 쉽다. 관람 이력 계산을 위한 내부 영화 조회와 draft 상영 생성은 유지한다. Movies 모듈의 공개 조회 API에서 공개 여부를 처리하고 추천 서비스가 다른 모듈의 collection을 직접 읽지 않게 한다. 기존 추천·홈 테스트에서 draft가 후보에서 빠지는지 확인한다. 공개 상태와 관련된 다른 영화관 정책은 추가하지 않는다. 이번에는 정적 경로를 확인했다.

### 7. P2 · race가 같은 자원의 복제본 간 경쟁을 증명하지 못하는 경우가 있다

[가입 race](../tests/api/race/user-signup-race.js#L26)는 전체 이메일 그룹의 복제본 집합만 검사한다. 각 이메일의 경쟁 요청은 한 프로세스에만 보내고 이메일마다 다른 프로세스를 사용해도 통과한다. JWT·선점·구매 race에도 합산 검사가 있다. [상영 overlap race](../tests/api/race/showtime-overlap-race.js#L84)는 복제본 검사 자체가 없다.

실제 검증 함수를 VM에서 실행한 반례는 다음과 같다. 운영 API 경합 재현이 아니라 **테스트 판정 로직의 반례**다.

- 이메일 A의 요청은 api-0만, 이메일 B의 요청은 api-1만 사용했는데 `groups:2, total:4, replicas:2`로 통과했다.
- 상영 접수 응답 모두 api-only였는데 `succeeded:1, failed:1`로 통과했다.

**제안 7 — 동기 race는 자원 그룹마다 최소 두 복제본의 응답을 확인한다.** 상영 overlap은 접수 요청의 분산과 상영·티켓의 최종 상태를 검사하되, 이것을 Restate 실행 복제본의 분산 증명으로 표현하지 않는다. 기존 시나리오와 문서의 검증 범위를 맞추고, 실제 worker 복제본 관측 장치는 이번에는 추가하지 않는다. 한 그룹이 한 복제본에만 배정되면 검증 실패로 드러내며 통과할 때까지 재시도하지 않는다. 기존 판정의 반례가 실패하는지도 확인한다.

### 8. P2 · chaos와 일부 구매 race가 무관한 실패 응답을 정상으로 센다

[chaos](../tests/api/race/replica-chaos.js#L45)는 매번 새로운 이메일로 가입하지만 [오류율](../tests/api/race/replica-chaos.js#L125)은 전송 오류·5xx만 센다. 모든 요청이 403·404·429여도 네 복제본 헤더가 있으면 오류율 0%로 복구 조건을 만족할 수 있다. [구매 overlap](../tests/api/race/purchase-overlap-race.js#L29)도 모든 4xx를 정상 패자로 인정한다.

**제안 8 — chaos의 정상 응답은 201로 한정하고, 3xx·4xx는 예상하지 않은 실패로 즉시 보고한다.** 기존 전송 오류·5xx의 1% 기준은 유지한다. 구매 race의 정상 패자는 현재 시나리오에서 가능한 선점·판매·멱등성 충돌의 상태와 오류 코드로 한정한다. 인증 실패·rate limit은 정상 패자로 세지 않는다. 기존 검증기에 403/429를 넣으면 실패하고 허용한 충돌이면 통과하는지 확인한다.

### 9. P2 · MongoDB readiness가 majority 확인 실패를 놓친다

[준비 probe](../infra/compose.mongo.yml#L84)는 `runCommand`의 `ok`만 확인한다. generic command는 `{ok:1, writeConcernError:...}`를 반환할 수 있고, write concern 오류를 자동 예외로 바꾸지 않는다. 따라서 복제가 정체되어 majority 확인이 timeout이어도 준비 완료로 판정할 수 있다. [MongoDB 공식 명세](https://github.com/mongodb/specifications/blob/master/source/read-write-concern/read-write-concern.md#errors)

**제안 9 — 현재 runCommand probe에서 `ok === 1`, 삽입 수 1, `writeConcernError`와 `writeErrors`가 없음을 모두 확인한다.** 하나라도 만족하지 않으면 현재 대기 루프에 실패를 전달한다. topology·sleep·timeout은 유지한다. 공식 프로토콜과 코드를 대조했으며 실제 replica 장애는 주입하지 않았다.

### 10. P2 · S3 테스트 정리가 객체별 삭제 실패를 성공 처리한다

[emptyBucket](../tools/vitest-helpers/index.js#L53)은 `DeleteObjectsCommand` 응답을 버린다. S3는 HTTP 200에도 객체별 실패를 `Errors`로 반환한다. [AWS DeleteObjects 계약](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObjects.html)

실제 함수에 `Errors:[{Code:'InternalError',...}]`를 반환하는 client를 주입했을 때 정상 resolve함을 확인했다. 실제 S3 장애를 일으킨 것은 아니다. [afterEach](../tools/vitest-helpers/index.js#L130)가 이 함수를 사용하므로 다음 테스트로 객체가 남거나 최종 bucket 삭제에서 늦게 실패할 수 있다.

**제안 10 — DeleteObjects 응답의 Errors가 비어 있지 않으면 key/code를 담은 정리 오류를 던진다.** afterEach에 원래 실패를 전달하며 별도 재시도·대체 삭제 경로는 추가하지 않는다. 기존 lifecycle 계약 검증에서 일부 객체 삭제 실패가 전달되는지 확인한다.

### 11. P2 · 포크 후 env 값을 바꾸면 실행 경로마다 다르게 해석된다

[환경 문서](../docs/reference/environment.md#L20)는 Docker `--env-file`의 literal 규칙을 안내한다. 그러나 같은 `.env.infra`를 [reset](../infra/reset.sh#L8)과 [API 실행기](../tests/api/runner.sh#L13)는 Bash로 실행하고, [Compose](../tests/api/compose.yml#L2)는 env_file로 해석한다.

`VALUE=Dev$word`는 Docker에서는 문자 그대로지만 `set -u` Bash에서는 `word: unbound variable`로 실패한다. 이 Bash 동작은 임시 값으로 실행 확인했다. 공백이 있는 이름·따옴표도 소비 경로에 따라 달라진다. 현재 커밋된 단순 값에서 문제가 없다는 사실이 포크 후 재현성을 보장하지 않는다.

**제안 11 — 공용 env 파일은 Docker처럼 `KEY=값`을 문자 그대로 해석하는 계약으로 통일한다.** Bash source를 제거하고 공통 읽기 경로에서 첫 `=` 뒤의 값을 변수 보간·명령 실행·따옴표 제거 없이 주입한다. 공용 파일을 읽는 Compose에는 [raw 형식](https://docs.docker.com/reference/compose-file/services/#env_file)을 사용한다. frontend의 별도 Next.js env 규칙은 바꾸지 않는다. `$`·공백·따옴표·`=`를 포함한 값이 개발/외부 테스트에서 같음을 기존 env·실행기 계약 검증으로 확인한다. 새 dotenv 의존성은 추가하지 않는다.

## 추가 제안

| 번호   | Yes로 채택할 제안                                                    | 이유·영향·검증                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **12** | **이번 개선에서는 현재 인증 모델을 유지하고 간소화는 보류한다.**     | 즉시 계정 철회·refresh 재사용 탐지·동시 회전의 현재 보장을 유지한다. 인증은 여러 예제의 전제이므로 나머지 오류 수정과 함께 바꾸지 않는 편을 추천한다. [기존 간소화안](repository-simplification-review.md)은 별도 과제로 남기며 새 인증 기능도 추가하지 않는다.                                                                                                                                                       |
| **13** | **user/admin 비밀번호 입력에 UTF-8 72-byte 상한을 적용한다.**        | 생성·변경·로그인 요청에서 초과 입력은 400으로 거절하고 bcrypt는 유지한다. 같은 72-byte 접두어를 가진 서로 다른 입력이 동일하게 검증됨을 실제 라이브러리로 확인했다. 대가는 긴 비밀번호의 기존 허용 범위를 줄이는 것이다. 기존 스키마·인증 테스트에서 ASCII와 다중 바이트 경계를 확인한다.                                                                                                                             |
| **14** | **두 BFF의 최초 API 연결 실패를 기존 JSON 502로 응답한다.**          | [console](../apps/console/src/app/api/%5B...path%5D/route.ts#L88)·[user-app](../apps/user-app/src/app/api/%5B...path%5D/route.ts#L88)의 최초 호출에도 logout·refresh 경로와 같은 실패 계약을 적용한다. 네트워크 실패를 처리하며 프로그래밍 오류까지 포괄해서 삼키지 않는다. 자동 재시도는 추가하지 않는다. 기존 BFF·브라우저 테스트에서 응답 형식을 확인한다. 실제 Next.js 장애 응답은 이번 검토에서 재현하지 않았다. |
| **15** | **루트·도구·Vitest 부팅 스크립트를 기존 CI Oxlint 검사에 포함한다.** | 루트 Vitest 설정, dev-tools JavaScript, common의 global/teardown 스크립트처럼 커밋 훅에만 걸리는 파일을 기존 lint 진입점에서 검사한다. 새 lint 도구나 커버리지 기준은 추가하지 않는다. 대표 누락 파일의 직접 검사에서는 현재 오류가 없었다.                                                                                                                                                                           |

## 문서 제안

HTTP 예외의 공통 사용은 확정된 선택으로 [에러 규칙](../docs/apps.md#32-에러-규칙)에 반영했다. 아래는 별도로 Yes/No를 결정할 제안이다. SSE·상태 조회 문서는 2·5번 승인 시 해당 구현과 함께 갱신한다.

| 번호   | Yes로 채택할 제안                                                                                                | 이유·영향                                                                                                                                                                                                                                                                               |
| ------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **16** | **durable 작업의 실제 API owner 종료 테스트 추가는 보류하고, 현재 테스트가 직접 확인하는 범위로 설명을 고친다.** | [tests 문서](../docs/tests.md#L15)에 API chaos는 가입 트래픽의 우회와 복제본 복귀, Restate 복구 검사는 별도 counter workflow와 Restate 서버 재시작을 확인한다고 구분한다. 실제 구매·상영을 수행 중인 API owner의 인계까지 검증했다고 표현하지 않는다. 기존 테스트와 반복 CI는 유지한다. |
| **17** | **실행 가능한 API 문서의 주요 결과 설명에 본문 단언을 추가한다.**                                                | 우선 [구매 재시도](../apps/api/api-docs/purchases.spec#L31)의 최초·재응답 전체를 비교하고, 기본값·목록 순서를 약속한 항목도 해당 값을 검사한다. 기존 shell spec과 jq를 사용하며 새 계약 DSL은 만들지 않는다. 상태 코드만 확인하는 항목은 제목도 그 범위로 맞춘다.                       |
| **18** | **README 시작 단계에 지원 접속 경로와 브라우저 접속 방법을 연결한다.**                                           | Remote SSH 후 Reopen, 수동 포트 전달 또는 기존 tunnel 명령을 바로 찾게 한다. 현재 도메인 읽기 순서에서 대응하는 대표 테스트로 연결해 어떤 기술 보장을 읽어야 하는지도 드러낸다. 새 개발 환경이나 자동 포트 공개 설정은 추가하지 않는다.                                                 |
| **19** | **개발 규칙에서 구현이 없는 clean 보장 문장을 삭제한다.**                                                        | [현재 문장](../docs/reference/conventions.md#L23)에 맞추기 위해 새 clean 도구를 구현하지 않는다. 실제 도구를 추가할 요구가 생기면 그때 삭제 범위를 설계한다.                                                                                                                            |
| **20** | **기존 TODO 앞부분에 현재 미결 항목과 승인·철회·완료 상태를 요약한다.**                                          | 기존 검토 원문과 사용자 주석은 보존한다. 철회한 제안이 현재 권고처럼 읽히지 않게 각 상태의 근거 위치를 연결한다. 과거 코드를 다시 수정하는 작업은 포함하지 않는다.                                                                                                                      |

## 검증과 범위

- `pnpm run lint` 통과: 타입·코드·format·문서 링크·shell 검사. 이 명령의 기존 검사 범위 안에서의 결과다.
- `pnpm run test` 통과: testing 28개, common 514개, API 440개, 합계 **982개 / 81개 파일**. common·API의 수집 대상 커버리지는 statement·branch·function·line 모두 100%다.
- 추가 실행: 실제 DTO의 null 처리, bcrypt 입력 한계, race 판정의 반례, S3 정리의 객체별 실패 응답, Bash env 해석. 저장소에 새 테스트 파일을 만들지 않고 메모리·stdin에서 확인했다.
- AtoZ·브라우저 E2E·실제 다중 복제본 race·benchmark는 실행하지 않았다. 검토 문서 작성 범위에서 기본 검사와 위 반례 검증을 수행했으며, `atoz`의 인프라 volume reset이나 별도 스택 장애 주입까지 진행하지 않았다. 외부 provider·운영 배포의 적합성을 인증하는 검토도 아니다.

기술 예제의 오류 수정은 2·3·4·7~11번을 우선 추천한다. 1·12·16번은 해결·확장을 보류하는 구체안이며, 5·6번은 위에 적은 작은 계약으로 범위를 정하는 안이다. 각 제안의 Yes는 해당 범위만 승인하는 것으로 해석한다. 이번 작업은 검토 제안과 확정된 공통 에러 문서의 정리이며 기능 수정이나 새 테스트 파일 작성은 포함하지 않았다.
