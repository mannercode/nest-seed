# 런타임 장치의 필요성 검토

`14ae8d09`의 코드와 현행 계약을 대조했다. 아래는 변경 제안이며 새 개발 규칙이 아니다. 액세스 토큰은 5분 만료까지 유효하고, 리프레시 세션만 서버에서 회수한다는 결정을 기준으로 삼았다.

`apps/api/src`, 두 frontend의 `src`, `libs/common/src`의 운영 코드 351개 파일을 목록화하고 상태·분기·재시도·자동 변환을 검색했다. 인증·BFF·구매·선점·상영 생성·파일 관리와 공통 연동은 호출 흐름과 관련 테스트를 읽었다. 인프라·실행 도구·외부 테스트는 이 보장의 전제와 대조했다. 모든 장애 조합을 실제로 주입한 검증은 아니며, 기존 테스트의 존재를 정책 채택의 근거로 삼지도 않았다.

## 1. 정책을 줄이는 것이 좋다고 판단한 부분

### 리프레시 재사용 시 현재 세션까지 폐기

[JwtAuthService](../../libs/common/src/auth/jwt-auth.service.ts)의 `rejectConsumedOrReused`는 이미 사용한 토큰이 다시 오면, 소비 후 2초 이내에는 409만 반환하고 그 이후에는 같은 로그인 세션의 새 리프레시 토큰까지 폐기한다. 여기서 family는 한 로그인에서 회전한 토큰들의 묶음이며, 다른 로그인 세션까지 모두 폐기하는 것은 아니다. [테스트](../../libs/common/src/auth/__tests__/jwt-auth.service.spec.ts)도 두 경우를 명시한다.

따라서 정상 요청이 늦게 재전송돼도 새 토큰까지 사용할 수 없게 된다. 2초는 동시 요청과 탈취를 확실히 구분하는 기준이 아니다. 재사용된 이전 토큰을 거부하는 것과, 현재 세션까지 폐기하는 것은 별개의 보안 정책이다.

**권고:** 재사용을 이유로 현재 세션까지 폐기하는 정책은 제거하는 쪽이 낫다. 서버에 현재 리프레시 토큰의 해시를 두고 원자적으로 교체하는 구조를 검토한다. 이 경우 탈취 의심 시 세션 전체를 차단하는 보장은 포기한다. 현재 구현에서 폐기 표시(`revoked`)만 지우면 로그아웃과 재발급의 경합에서 세션이 되살아날 수 있으므로, 토큰 교체·로그아웃의 원자성은 함께 유지해야 한다.

### 이메일만 알아도 걸 수 있는 계정 잠금

[LoginRateLimiterService](../../apps/api/src/services/gateway/login-rate-limiter.service.ts)는 비밀번호 확인 전에 이메일별 실패 횟수를 검사한다. 현재 설정은 계정 5회·IP 50회·15분이다. 같은 이메일에 5회 실패하면 다른 IP에서 올바른 비밀번호로 시도해도 제한 시간 동안 429가 된다. 성공 시 초기화는 이 사전 검사 뒤에 있어 잠긴 계정을 풀어 주지 못한다. [인증 테스트](../../apps/api/src/__tests__/core/user-auth.spec.ts)는 이메일 정규화와 복제본 간 실패 횟수 공유를 검증한다.

**권고:** IP별 시도 제한과 계정 전체 잠금을 분리해서 판단한다. 시드의 기본 정책으로 이메일만으로 정상 사용자까지 잠그는 동작은 빼는 쪽이 낫다. 여러 IP에서 한 계정을 공격하는 시도에 대한 제한은 약해진다. IP 제한을 유지한다면 BFF의 클라이언트 IP 전달과 신뢰 경계도 유지한다.

### 진행 알림 발행을 업무 완료의 필수 조건으로 사용

[상영 생성 workflow](../../apps/api/src/services/application/showtime-creation/worker/workflow.ts)는 `waiting`·`processing` 발행을 기다린 뒤 DB 작업을 시작하고, DB 커밋 뒤에도 `succeeded` 발행이 끝나야 결과를 반환한다. 발행마다 10초 timeout과 별도 재시도 정책이 있다. NATS 발행이 계속 실패하면 생성 시작 또는 완료 응답까지 실패한다. [테스트](../../apps/api/src/services/application/showtime-creation/worker/__tests__/workflow.spec.ts)는 첫 발행이 멈추면 DB 단계에 진입하지 않는 흐름을 확인한다.

이는 [SSE는 best-effort이고 상태 API로 종결 결과를 조회한다는 설명](../apps.md#24-saga-오케스트레이션--restate)과 맞지 않는다. 발행을 재시도해도 Core NATS가 연결되지 않은 소비자에게 전달을 보장해 주는 것은 아니다.

**권고:** 진행 알림의 실패가 DB 작업과 종결 결과를 막지 않도록 계약을 정리한다. 실패를 기록하고 알림 누락은 허용하되 상태 조회를 유지하는 쪽이 문서의 목적에 맞다. 모든 진행 알림의 발행을 업무 성공 조건으로 삼는 보장은 포기한다. 문서와 구현이 충돌하므로 구현 변경 전 계약 선택이 필요하다.

## 2. 구현을 명확하게 줄일 수 있는 부분

### MongoDB 조건식의 자동 ID 변환

[encodeMongoFilter](../../libs/common/src/mongodb/mongo.util.ts)는 `_id`뿐 아니라 `$and`·`$or`·`$nor`를 재귀 순회하고, `$in`·`$not` 등 연산자 목록에 따라 문자열을 ObjectId로 바꾼다. [CrudRepository](../../libs/common/src/mongodb/crud.repository.ts)의 조회·갱신 경로가 이를 호출하므로 앱 Repository의 필터는 드라이버에 전달되기 전에 다시 해석된다. 일반 문자열 필드까지 ID로 추측하는 코드는 아니지만, 지원할 조건식 형태를 공통 변환기가 알아야 하는 구조다.

**권고:** 앞서 논의한 명시적인 방식이 더 낫다. common의 ID 조건 생성 API에서 변환을 수행하고, Repository는 그 API로 필요한 조건을 직접 조립한다. DTO와 Repository의 입력은 계속 문자열로 받는다. MongoDB 의존을 common에 두기 위해 조건식 전체를 자동 해석해야 하는 것은 아니다. Temporal·BSON처럼 실제 값의 타입을 기준으로 수행하는 저장 형식 변환과도 구분한다.

### 타입을 추측하는 JSON·요청 변환

[JsonUtil.parse](../../libs/common/src/utils/json.ts)는 문자열의 모양만으로 날짜를 추측하고, JSON을 직접 훑어 일부 큰 정수만 문자열로 바꾼다. 실제 소스를 실행해 다음을 확인했다.

| 입력                        | 현재 결과                                      |
| --------------------------- | ---------------------------------------------- |
| `{"title":"2026-09-15"}`    | `title`이 문자열 대신 `Temporal.PlainDate`     |
| `{"n":9007199254740993}`    | `n`이 문자열                                   |
| `{"n":9223372036854775809}` | `n`이 정밀도를 잃은 숫자 `9223372036854776000` |

또한 [사용자 요청 변환](../../apps/api/src/services/core/users/dtos/request-value.schema.ts)과 [상영 생성 DTO](../../apps/api/src/services/application/showtime-creation/dtos/bulk-create-showtimes.dto.ts)를 실행하면 비밀번호 `true`는 `"true"`, 상영 길이 `true`는 `1`, 영화 ID `false`는 `"false"`로 스키마를 통과한다. 이것이 로그인이나 상영 생성의 최종 성공을 뜻하지는 않지만, 요청 단계에서 잘못된 타입을 받아들이고 있다.

**권고:** 기존 JSON 유틸은 유지하되 특수 직렬화·복원은 이름과 호출부에서 명시한다. 날짜는 알려진 필드의 스키마에서 변환하고 JSON 본문은 실제 타입으로 받는다. 쿼리 문자열의 숫자 변환과 혼동하지 않는다. 현재 [Restate serde](../../libs/common/src/restate/temporal-json.serde.ts)는 Temporal 복원에 의존하므로 그 계약을 보존하면서 분리해야 한다. `JsonUtil.parse`가 모든 HTTP 요청 본문을 파싱하는 구조는 아니다.

### 두 BFF의 동일한 세션 처리

console과 user-app의 `app/api/[...path]/route.ts`는 쿠키 이름과 인증 경로 상수만 다르고, [console helper](../../apps/console/src/lib/bff-proxy.ts)와 [user-app helper](../../apps/user-app/src/lib/bff-proxy.ts)는 동일하다. 양쪽에 리프레시 중복 요청을 합치는 Map과 결과를 1초 보관하는 처리가 복제돼 있다. 이 Map은 프로세스 내부에서만 공유된다.

**권고:** 쿠키·프록시·토큰 갱신 구현을 한곳에 두고 앱은 역할 설정을 전달한다. 재사용 시 세션 폐기 정책을 먼저 결정한 뒤 409와 유예 처리의 필요성을 다시 판단한다. 원본 요청 재시도 실패 시에도 이미 회전한 쿠키를 저장하는 처리, HttpOnly·same-origin·IP 전달 경계는 현재 BFF 계약에 필요하다.

별도로 액세스 쿠키의 `maxAge`가 두 앱 모두 30분으로 남아 있다. JWT의 5분 유효기간을 늘리지는 않지만, 만료 정책이 서로 다른 위치에서 관리되고 있다는 실제 불일치다.

### 만료가 없는 좌석 선점의 호환 분기

[TicketHoldingService](../../apps/api/src/services/core/ticket-holding/ticket-holding.service.ts)의 정상 선점 생성은 항상 Redis `PX`로 만료를 설정한다. 그런데 구매 claim·rollback Lua는 `PTTL=-1`인 무기한 선점을 보존하는 경로와 `persistWithoutExpiry` 병합까지 지원한다. 운영 코드에서 이 상태를 만드는 경로는 찾지 못했다.

**권고:** 무기한 선점이 지원 계약이 아니라면 그 보존 분기를 제거한다. 반면 일부 좌석만 구매할 때 나머지 선점을 남기는 처리와, 여러 상영 중 뒤 그룹이 실패하면 앞 그룹의 원래 만료를 복원하는 처리는 [현재 테스트](../../apps/api/src/__tests__/core/ticket-holding.spec.ts)가 검증하는 계약이다. 한 구매를 한 상영으로 제한하지 않는 한 통째로 없앨 수 없다. TypeScript 커버리지 100%도 Lua 문자열 내부 분기를 모두 검증했다는 뜻은 아니다.

### 읽지 않는 별도 상영 버전 카운터

[TheatersRepository](../../apps/api/src/services/core/theaters/theaters.repository.ts)의 `acquireShowtimeScheduleGuards`는 `showtimeScheduleVersion`을 증가시키지만 그 값을 읽거나 비교하는 소비자는 없다. 동시에 [공통 timestamped](../../libs/common/src/mongodb/crud.repository.ts)가 이미 `__v`를 증가시킨다.

**권고:** 별도 카운터는 줄일 수 있다. 다만 같은 극장 문서에 실제 쓰기를 만들어 MongoDB transaction끼리 충돌하게 하는 동작은 유지해야 한다. 겹치는 상영의 동시 생성을 막는 것은 그 쓰기 경합이다. `__v` 전체를 없애자는 뜻도 아니다. 영화 수정은 실제로 이를 CAS 비교에 사용한다.

## 3. 자동 정리가 오히려 문제를 만드는 경로

[AssetsService.finalizeUpload](../../apps/api/src/services/infrastructure/assets/assets.service.ts)는 소유권 갱신이 실패하면 곧바로 S3 객체와 DB 행을 삭제한다. [assignOwner](../../apps/api/src/services/infrastructure/assets/assets.repository.ts)는 생성 시각으로 만료 여부를 검사하며 기존 소유자는 조건에 포함하지 않는다.

[영화 finalize](../../apps/api/src/services/core/movies/movies.service.ts)는 소유자 지정 → 영화 연결 → pending 제거 순서다. 따라서 **소유자 지정 성공 → 영화 연결 실패 → 업로드 만료 후 재시도**에서는 이미 소유자가 있는 파일도 만료 분기로 삭제될 수 있다. 이는 코드 경로에서 확인한 위험이며 실제 S3 장애를 주입해 재현한 결과는 아니다. 기존 테스트는 최초 만료 실패 시 삭제와, 완료된 영화 연결의 중복 호출을 다루지만 이 중간 실패 경로를 다루지 않는다.

**권고:** 같은 소유자의 완료 재시도는 멱등 처리하고, 만료 정리는 소유자가 없는 업로드에 한정한다. 소유권 갱신 실패를 무조건 삭제 명령으로 해석하지 않는다. 새 복구 엔진을 추가하기보다 완료와 만료 정리의 책임을 분리할 문제다. 삭제와 상영 생성 사이의 별도 정합성 문제는 [기존 검토](catalog-deletion-showtime-creation-race.md)에 남아 있다.

## 4. 우선순위가 낮은 단순화 후보

| 장치                                                                                                                                   | 판단과 대가                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [구매의 Redis blocking lock](../../apps/api/src/services/application/purchase/purchase.service.ts)                                     | 동일한 티켓 묶음의 요청을 직렬화하는 최적화다. `[A,B]`와 `[B,C]`는 직렬화하지 못하며 판매 정합성은 DB가 지킨다. 제거를 검토할 수 있지만 불필요한 결제 생성·보상이 늘 수 있다. 구매 상태 머신·lease와 함께 없애면 안 된다. |
| [상영 생성 Orchestrator](../../apps/api/src/services/application/showtime-creation/internal/showtime-creation-orchestrator.service.ts) | 로그와 workflow client 전달만 맡으므로 상위 서비스에 합칠 수 있다. common의 Restate 연동 경계는 유지한다.                                                                                                                 |
| [MongoDB 연결 풀](../../libs/common/src/mongodb/mongo-connection.ts)                                                                   | application은 최소 50개 연결을 유지하고 test-file은 0으로 두는 분기다. 현재 검토에서는 최소 50의 필요성을 뒷받침하는 측정 근거를 찾지 못했다. 측정 후 단순화할 후보이며 transaction·write concern과는 별개다.             |

## 5. 유지할 근거가 있는 장치

| 장치                                                     | 제거하면 잃는 보장                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 리프레시 서버 상태·원자 교체·로그아웃 경합 제어          | 이전 토큰의 재사용 거부와 로그아웃 뒤 늦은 재발급 차단. 재사용 시 현재 세션 폐기 정책과 구분한다.                                          |
| 좌석 선점 Lua·소유자 조건·TTL                            | 여러 복제본에서 중복 선점 방지, 다른 사용자의 선점 오삭제 방지, 방치된 선점 만료.                                                          |
| 구매 상태 머신·완료/복구 lease·payment resolution·outbox | 외부 효과 사이에 프로세스가 죽었을 때 판매·취소·이벤트 발행을 이어 갈 기준. 늦은 결제와 겹치는 좌석 묶음은 Redis 락만으로 해결되지 않는다. |
| 상영 제출 기록·Restate workflow key·DB operation 기록    | 각각 요청 재제출과 소유권, 실행 재개, DB 커밋 뒤 journal 기록 전 장애의 중복 생성을 담당한다. 동일한 멱등성을 세 번 구현한 것은 아니다.    |
| MongoDB transaction·상영 guard 쓰기·영화 CAS             | 묶음 생성의 원자성, 겹치는 상영의 동시 생성 방지, publish 조건과 동시 수정의 충돌 방지.                                                    |
| 파일 pending·소유권·실패 시 DB 정리 기준 보존            | S3와 MongoDB 사이의 부분 실패를 추적하고 다른 소유자의 파일을 삭제하지 않을 근거. 실패 시 무조건 삭제하는 finalize 분기와 구분한다.        |
| common의 외부 SDK 연동·기존 UUID 등 유틸                 | SDK 사용법과 반복 구현을 한곳에 두려는 저장소의 의도. 사용처가 적거나 Node API를 감쌌다는 이유만으로 제거하지 않는다.                      |
| 실제 인프라 테스트·다중 복제본·명시적 준비/정리          | 프로세스 경합과 장애 경계를 실제로 관찰하기 위한 조건. 일반 health가 Restate deployment 등록까지 보장하는 것은 아니다.                     |

분산 실행과 복구는 README가 명시한 시드의 목적이다. 이 목적을 유지하는 동안 MongoDB·Redis·NATS/JetStream·Restate 전체를 제거하는 것은 이번 단순화의 권고가 아니다. 로깅·health·설정 주입·기본 CRUD·추천·화면 조합에서는 위 항목과 별개로 즉시 제거를 권할 정도의 추가 장치를 찾지 못했다.

## 6. 확인 범위와 남은 검증

JSON과 요청 스키마의 자동 변환은 실제 TypeScript 소스를 실행해 확인했다. 나머지 판단은 구현·호출부·기존 테스트의 대조에 근거하며, 지연 재요청·NATS 장애·파일 연결 실패를 새로 주입하지 않았다. 제안을 구현할 때 해당 계약의 회귀 검증이 필요하다.

검토 중 이전 인증 변경에서 빠진 API 문서 테스트를 발견했다. 전체 로그아웃 후 리프레시는 거부하고 만료 전 액세스 토큰은 허용하도록 기대값을 맞추고, 살아 있는 세션을 먼저 만들어 실제 회수를 검증했다. 다중 복제본의 `pnpm run api-docs`는 76개 모두 통과했다. 위 단순화 제안에 따른 런타임 코드는 변경하지 않았다.
