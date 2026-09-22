# 테스트 검토

최초 검토 대상은 추적된 `tests/` 25파일과 `apps/api/src/**/__tests__/` 54파일이다. 텍스트 77파일을 본문까지 읽었고 이미지·작은 업로드 fixture 2개는 크기와 signature를 확인했다. 아래 근거는 당시 코드 경로를 읽은 결과다. 현재 반영·검증 결과는 각 항목의 상태와 [통합 목록](README.md)에 둔다.

## 판단

테스트를 한꺼번에 줄이는 것이 우선은 아니다. API의 대부분은 실제 Nest 앱·인프라에서 요청, 저장 상태, 예외를 확인한다. `tests/`도 API 통합 테스트가 대신할 수 없는 프로세스 간 HTTP 경쟁, SSE fan-out, production frontend 연결을 소유한다. 단위 테스트 숫자가 다시 크게 불어난 상태는 아니다.

먼저 고칠 것은 이미 있는 테스트가 성공을 잘못 판정하거나 작업 완료를 기다리지 않는 부분이다. 그 다음 같은 정상 동작을 응답용·DB용 테스트로 기계적으로 나눈 사례를 합치면 된다. 100% coverage, API 4개 복제본, 별도 CI 반복은 의도된 선택으로 유지한다. 검증을 생략하거나 assertion을 약하게 만들어 줄여서는 안 된다.

## 기존 검증의 정확성을 위해 고칠 부분

### T1. 상영 완료 SSE 구독이 요청보다 늦게 시작한다

상태: 완료. `HttpTestClient.sse`에 수신 준비 콜백을 추가하고 상영 helper가 준비 후 POST·종결 수신·스트림 정리를 책임지도록 바꿨다. 첫 이벤트가 없는 실제 HTTP 스트림의 준비와 이후 이벤트 수신도 기존 spec에서 검증한다.

- 근거: `apps/api/src/__tests__/application/showtime-creation.spec.ts:509`의 정상 흐름 `beforeEach`가 POST를 시작한다. `:562`, `:574`의 DB 검증은 202를 받은 뒤 `waitForCompletion()`을 호출한다. 앞의 SSE 검증도 POST가 시작된 뒤 구독한다.
- `showtime-creation.utils.ts:5`는 `.sse()`를 호출할 뿐 구독 성립을 기다리지 않는다. `libs/testing/src/http.test-client.ts:130`의 반환값은 연결 완료 Promise가 아니라 client 자신이다. `showtime-creation.events.ts:12`의 일반 Subject에는 replay가 없다.
- 따라서 빠른 workflow의 완료가 구독 전에 발행되면 정상 동작도 테스트 timeout으로 끝날 수 있다. 코드를 오래 실행하게 하거나 timeout을 늘리는 해결은 부적절하다.
- 기존 SSE 시나리오에서 구독 준비를 명시적으로 확인한 다음 POST해야 한다. DB 생성 결과를 검증하는 시나리오는 SSE 전달 계약과 분리해 확정된 작업 종결을 기다릴 수 있다. 이미 있는 상태 API 테스트와 합치는지도 함께 판단한다. 새 범용 polling/retry 계층까지 만들 필요는 없다.
- helper가 sagaId를 받지 않는 것은 현재 테스트마다 PROJECT_ID가 분리되고 대부분 한 작업만 제출하므로 독립적인 현행 버그로 확정하지 않았다. 다중 작업에 재사용하면 필터가 필요하다.

### T2. 성공한 모양만 보고 실패를 놓치는 기존 단언이 있다

상태: 완료. finalize 응답은 204 또는 예상한 AssetNotFound만 허용하며 성공 응답도 요구한다. 동일 saga 재실행은 성공을 먼저 단언하고, 정상 fixture는 상영 1개·티켓 8개를 독립 기대값으로 확인한다.

- `apps/api/src/__tests__/core/movies-assets.spec.ts:267`: 동시 finalize 8개를 `sendRaw()`로 보내고 응답을 버린다. 500이 섞여도 `imageUrls` 하나만 남으면 통과한다. 현재 허용하는 정상/충돌 응답을 구분해 검사하고 예상하지 못한 응답을 실패로 해야 한다. 새로운 경우의 수를 늘릴 작업이 아니다.
- `apps/api/src/__tests__/application/showtime-creation.spec.ts:931`: 같은 saga 동시 재실행 테스트는 `first.kind === 'succeeded'`일 때만 생성 개수 검증을 수행한다. 두 호출이 똑같이 `failed`를 반환해도 통과할 수 있다. 이 fixture의 기대 결과인 `succeeded`를 먼저 단언한다.
- 같은 파일 `:574`의 티켓 생성 검증은 실제 길이를 구현이 보고한 `createdTicketCount`와만 비교한다. 생성도 보고도 0이면 통과할 수 있다. 이 정상 fixture의 알려진 좌석 수와 결과를 확인하는 것이 더 직접적이다. 현재 여러 다른 시나리오도 count를 응답에서 가져오므로 기본 정상 시나리오 한 곳의 독립 기대값이 유용하다.

### T3. 비동기 자원 정리와 cron 완료를 명시적으로 기다려야 한다

상태: 완료. SSE stream·chaos worker·구매 barrier는 `finally`에서 정리한다. 에셋 정리는 서비스 작업을 직접 await하고 cron 등록도 확인한다. 관련 API 테스트 121개가 통과했으며, race 원본을 격리 실행해 handshake·POST·응답 검사·종결 대기·Docker kill/start 명령 실패 시 정리도 확인했다. 실제 SSE fan-out·복제본 재시작 실행 결과는 [통합 목록](README.md#완료된-검증-보완)에 둔다.

- `tests/api/race/sse-fanout-race.js:63`: 100개 stream을 열고 handshake·POST·응답 검사 중 실패하면 `:108`의 close까지 도달하지 않는다. 기존 작업 전체에 `try/finally`를 적용해 열린 stream을 정리한다.
- `tests/api/race/replica-chaos.js:78`: traffic worker를 시작한 뒤 `docker kill/start`가 실패하면 `state.stop`을 설정하지 못한다. 이 worker가 Node 프로세스를 계속 유지해 shell의 정리·진단도 늦어질 수 있다. worker 종료를 finally에서 보장한다. 새로운 장애 복구 기능을 추가할 필요는 없다.
- `apps/api/src/__tests__/infrastructure/assets.spec.ts:347`: cron `fireOnTick()` 뒤 1초 sleep으로 실제 cleanup 완료를 추측한다. 현 `@Cron` 옵션(`assets.service.ts:44`)은 `waitForCompletion`을 켜지 않고, 설치된 cron의 `fireOnTick`은 이 경우 callback Promise를 기다리지 않는다. cleanup 동작은 `await assetsService.cleanupExpiredUploads()`로 검증하고 스케줄 등록 확인은 필요한 최소 범위로 분리하는 편이 단순하다.
- TTL 자체를 확인하려는 `ticket-holding.spec.ts`의 실제 Redis 만료 대기나 S3 presigned URL 만료 대기는 위의 완료 추측 sleep과 다르다. 이를 모두 금지하거나 fake timer로 대체하면 인프라 계약 검증을 잃는다.
- 일부 purchase concurrency barrier도 해제 전에 assertion이 실패하면 작업이 멈춰 teardown까지 지연될 수 있다(`purchase.spec.ts:805` 이후 hold owner 변경, `:861` 이후 결제 중 claim 변경). 이미 다른 barrier에서 사용한 `finally` 해제 방식을 적용하면 된다.

### T4. 긴 외부 테스트가 5분 access token을 끝까지 재사용한다

상태: 부분 완료. [purchase-double-spend](../../tests/api/race/purchase-double-spend.js)는 `150e4f99`에서 매 반복 전 관리자 로그인·사용자 refresh를 추가했다. benchmark와 다른 장시간 시나리오는 아래 남은 범위를 검토한다.

- `.env.api:9`, `:13`은 사용자·관리자 access token을 5분으로 정한다.
- benchmark는 `tests/api/benchmark/run.sh:108`에서 한 번 로그인하고 seed한 다음 같은 token을 k6에 넘긴다. 기본 seed 한 회는 30초이고, `crud.js:21`의 7개 시나리오는 마지막 종료까지 약 291초가 걸린다. 새 환경에서 seed가 한 회만 있어도 전체가 5분을 넘는다. 마지막 쓰기는 성능 문제가 아니라 인증 만료로 실패할 수 있다.
- `purchase-double-spend`를 제외한 race는 runner의 admin token을 시나리오 전체에 사용한다. holding/purchase-overlap은 사용자 token도 준비 단계에서만 얻는다. 실행이 5분을 넘으면 시나리오 목적과 무관한 401을 받는다. 실제 소요 시간은 실행으로 확인해야 한다.
- access TTL을 늘려 숨기지 않는다. benchmark 단계별 인증과 긴 실행의 token 갱신 책임을 test client에서 명시적으로 처리하는 최소 변경이 필요하다. 보안 기능이나 일반 로그인 프레임워크를 만들 일은 아니다. 짧은 시나리오까지 새 추상화에 강제 편입하지 않는다.

## 제목·문서가 실제로 검증한 것보다 강한 부분

이 항목들은 새 테스트를 의무적으로 늘리라는 뜻이 아니다. 현재 보장을 정확히 설명하는 것이 우선이다.

| 근거                                                                                | 실제 검증                                                                     | 필요한 표현 정리                                                                                                                                           |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/api/race/purchase-overlap-race.js:1`, `:155`; `docs/tests.md` 시나리오 표    | 승자 하나, 완료 구매 이력 하나, 승자 티켓만 sold                              | 결제 전에 선점 claim에서 패자가 거절될 수 있다. 이 테스트가 결제 취소를 확인하지 않으므로 “패자 보상 검증”을 빼고 보상은 API 통합 테스트의 책임이라고 설명 |
| `purchase-double-spend.js:98` 이후                                                  | 승자 구매 read-back과 paymentId 일치                                          | 실제 결제 collection의 유일성을 세는 것이 아니다. “결제를 하나만 남김”보다 관측한 구매 결과를 기술                                                         |
| signup/holding/purchase/JWT race의 `replicaSet`                                     | 한 반복 전체에 2개 이상 API 응답 관측                                         | 각 충돌 키의 요청이 여러 프로세스에 분산됐다는 보장과 구분. per-key 검증 확대는 이번 필수 작업이 아님                                                      |
| `showtime-overlap-race.js:1`, `:124`                                                | 겹치는 요청들의 SSE terminal 결과에서 성공 하나 확인                          | 별도 Redis 분산 락을 확인하는 테스트가 아니며 복제본 헤더도 검사하지 않음. guard CAS/transaction과 HTTP 스택 전제를 구분                                   |
| `apps/api/src/__tests__/application/showtime-creation.spec.ts:436`                  | 같은 Repository 인스턴스의 두 acquire 호출                                    | “두 replica”보다 “동시 claim 요청”이 정확                                                                                                                  |
| `purchase-events.spec.ts:47`                                                        | 한 Node 프로세스의 Nest context 4개, 알림 로그 1회 관측                       | 실제 컨테이너 4개나 영구 exactly-once 증명이 아님. shared consumer 동작 관찰로 설명                                                                        |
| `tests/web/e2e/console-auth-flow.spec.ts:104`, `:157`; `user-auth-flow.spec.ts:107` | cookie에 `expired-access-token`이라는 비 JWT 문자열을 넣고 401 이후 갱신 확인 | 실제 시간 만료를 재현한 것이 아니므로 “access 인증 실패 시 갱신”으로 표현. 추가 시간 제어 테스트가 필수인 것은 아님                                        |
| console 동시 요청 테스트 `:157`                                                     | 두 요청 성공과 쿠키 교체, 이후 세션 유지                                      | refresh 호출 횟수를 직접 세지 않으므로 “한 번만 회전”을 확인했다고 쓰지 않음                                                                               |
| `ticket-holding.spec.ts:213`                                                        | 부분 구매 이후 나머지 hold 목록·타인 선점 거절                                | TTL 보존 값을 직접 확인하지 않으므로 제목에서 해당 보장까지 검증했다고 표현하지 않음                                                                       |
| `jwt-refresh-race.js:111`                                                           | 교체된 현재 refresh token으로 재갱신 성공                                     | 제거된 token family 장치를 연상시키는 “token family 유지” 대신 “현재 로그인 세션 유지”                                                                     |

`waitFor()`의 짧은 polling은 NATS 처리 완료라는 관측 가능한 조건을 기다리므로 무조건 제거할 sleep 꼼수로 보지 않는다. 단, count가 처음 1이 되는 순간을 보았다고 이후 중복 전달까지 불가능하다는 결론은 내릴 수 없다.

## 합치거나 줄일 수 있지만 일괄 수정하지 않을 부분

1. **응답 전용과 저장 결과 전용 정상 테스트.** 극장·영화·사용자 update/delete, booking hold, asset finalize/delete, purchase 성공은 같은 fixture와 행위를 반복한다. 한 시나리오에서 HTTP 응답과 DB/스토리지 결과를 함께 단언하면 보장 손실 없이 줄일 수 있다. 실패 조건이 다른 테스트까지 하나의 거대한 테스트로 합치지는 않는다.
2. **API 내부 unit 위치.** 추천 정렬·Seatmap은 작은 순수 계산의 독립 계약이므로 직접 테스트가 적절하다. RequestValidationPipe spec은 HTTP 앱을 띄우므로 단순한 unit이 아니다. API 공통 통합 폴더로 이동할 수 있지만 위치만 바꾸는 것은 우선순위가 낮다. config schema는 env 없이 변환 규칙을 명확히 확인하므로 억지로 전체 앱 통합 테스트에 합칠 이익이 적다.
3. **workflow unit.** cancellation 분류와 멈춘 알림의 deadline을 fake context/timer로 확인한다. Restate 복구를 증명하는 테스트로 해석하면 안 되지만 실제 30초 대기를 피하는 좁은 SDK 경계 검증으로 유지할 근거가 있다. 광범위한 orchestration mock 테스트 추가는 권하지 않는다.
4. **알림 unit 4개.** `purchase-events.spec.ts` 후반은 fake iterator lifecycle 테스트다. 이미 통합 파일 안에 있으며 파일 이동·삭제 자체는 단순화 이익이 작다. 정상 종료/예기치 않은 종료 구분은 유용하다. “초기화 전 종료” 한 case는 낮은 가치지만 분기 게이트와 실제 lifecycle을 고려해 단독 삭제 대상이라고 단정하지 않았다.
5. **데모 브라우저 테스트.** 18개는 가입/로그인/세션·영화·극장·사용자 관리의 실제 연결을 확인한다. 앞서 삭제한 수십 개 proxy unit suite와 다르다. 다만 51회 로그인 실패 IP 전달, payload 상한, 쿠키 expiry 헤더 비교는 작은 화면 데모보다 BFF 계약 검증에 가깝다. 데모의 해당 정책을 유지한다면 현재 검증도 이유가 있으므로 기능은 둔 채 테스트만 무작정 없애지 않는다. UI의 기본 동작 외 보안 경우의 수를 더 확대하지 않는다.
6. **이름과 fixture.** `movies-flow.spec.ts`에는 극장·사용자 삭제까지 들어가므로 `console-management.spec.ts`가 더 정확하다. API `describe('XService')` 안에 HTTP contract가 있는 것은 오류가 아니나 `Movies API`, `Booking`처럼 대상 의미를 맞추면 읽기 쉽다. `home.spec.ts`의 별도 `HomeResponse`와 cast는 이미 `UserHomeViewSchema`가 타입을 추론하므로 중복이다. 이런 작은 정리는 기능 수정 때 묶을 수 있으며 전체 네이밍 재작성 사유는 아니다.

## 유지할 범위와 추가하지 않을 범위

- 사용자·관리자 역할별 인증/인가, DTO 날짜 변환, 공개 영화 노출, 실제 Mongo/Redis/S3 경계, 구매·상영의 기존 정합성 검증은 시드의 핵심 예제다.
- 4 replica / 100% coverage / 반복 CI는 유지한다. 반복 횟수가 많다는 이유만으로 과잉이라고 결론 내리지 않는다.
- race script마다 setup과 기대 결과를 직접 쓰는 것은 읽기 쉽다. 공통 fixture와 HTTP client가 이미 있으므로 새 scenario registry·DSL·복잡한 test framework로 더 통합하지 않는다.
- benchmark는 기본 AtoZ 밖의 선택 도구이며 동일 조건 비교 목적이 명확하다. 다양한 운영 부하 프로파일·성능 보장 SLA를 더 넣지 않는다.
- per-key 복제본 분산 보장, 실제 업무 소유 프로세스 종료 후 복구, 모든 잘못된 DTO 조합, 데모 모든 네트워크 실패 case는 이번 필수 테스트 목록으로 늘리지 않는다.
- 구매 보상과 workflow 재시도는 API 통합 테스트에서 실제 DB 경계와 함께 검증한다. `replica-chaos`는 가입 트래픽 가용성을 볼 뿐 구매/상영 workflow의 실행 소유 프로세스 종료를 시험하지 않는다. 인프라 Restate journal 복구 테스트와도 보장을 구분한다.

## 최초 검토의 한계

최초 검토에서는 테스트 실행, 실패 주입 재현, 이미지 fixture의 시각적 적절성 검사를 하지 않았다. 이후 수정·실행 결과는 위 상태에 별도로 표시했다. 외부 스택 시나리오를 더 만드는 것은 별도 결정이다.
