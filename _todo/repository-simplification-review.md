# 저장소 단순화 검토

주석은 증상이고, 근본 문제는 “실무용 seed”와 “분산 시스템 실험실”을 한 저장소에 동시에 넣은 것이다. 미래 장애·확장·보안 요구를 먼저 구현하고, 그 복잡성을 다시 문서와 테스트로 방어하고 있다. [README](../README.md#L9)

## 주요 검토 결과

### 1. 검증량과 별개로 실제 정합성 오류가 있었다

- 페이지 목록은 soft-delete 문서를 제외하지만 `total`에는 포함했다. 조회와 `total`이 같은 active filter를 쓰도록 수정했다. [구현](../libs/common/src/mongodb/crud.repository.ts), [테스트](../libs/common/src/mongodb/__tests__/crud.repository.spec.ts)
- 영화·극장 삭제와 상영 생성 경합은 이미 미해결 상태로 문서화돼 있다. [구현](../apps/api/src/services/application/catalog-management/catalog-management.service.ts#L12), [기존 TODO](catalog-deletion-showtime-creation-race.md#L17)
- NATS handler 하나의 예외이 해당 소비 루프를 종료했다. 핸들러별로 오류를 기록하고 나머지 핸들러와 다음 메시지를 계속 처리하도록 수정했다. [구현](../libs/common/src/nats/nats-pubsub.service.ts)

**  네 말에는 동의. 그런데 코드를 보니  describe('insert and mapping', () => {  이렇게 되어있던데 이거 적절한가? 다른 곳도 이런가? 테스트 작성 지침 읽어본 것인가?  **


### 2. 개발 자동화가 편의 수준을 넘어 파괴적이다

- Dev Container를 시작할 때마다 의존성을 다시 설치하고 `infra/reset.sh`로 모든 volume을 삭제한다. [Dev Container](../.devcontainer/devcontainer.json#L40), [reset](../infra/reset.sh#L24)
- `dev`와 frontend `start` 전에 포트 소유자가 프로젝트 프로세스인지 확인하지 않고 `SIGKILL`한다. [free-port](../tools/dev-tools/free-port.js#L44)

둘 다 없애고 설치·초기화는 명시적 명령으로 두는 것이 맞다.

**  다른 개발자와 공유하는 것이 아니라 단독으로 사용하는 개발 컨테이너인데 파괴적이라고 단정하긴 어렵지 않나? **

### 3. 테스트가 품질 도구가 아니라 별도 제품이 됐다

API와 common의 운영 소스는 약 12,343줄인데 테스트 소스는 약 16,939줄이다. 100% 커버리지를 맞추기 위해 컴파일러 AST까지 분석해 coverage 제외 주석을 주입한다. [Vitest 설정](../vitest.config.base.mjs#L69)

예약 실행만 계산해도 하루에 stability 반복 740회, race 시나리오 1,600회, AtoZ 8회다. race 한 번마다 4-replica 스택을 기동·정리한다. [Stability workflow](../.github/workflows/test-stability.yaml#L14), [Race workflow](../.github/workflows/test-api-race.yaml#L12), [Race runner](../tests/api/race/runner.sh#L46)

100% 게이트와 무차별 반복은 제거하고, PR 단일 실행과 실제로 문제가 있는 race의 제한된 반복만 남기는 편이 낫다.

** 별도 제품이라길래 테스트 코드가 많다고 이해했는데 아닌가? 100% 커버리지 원칙은 문서에 적어놨는데 읽어는 봤나? 예약 실행은 어차피 무료다. 많이 돌릴수록 에러 발견 높아진다. 왜 줄여? **

### 4. 구매의 분산 복구 장치가 실제 외부 효과를 보호하지 않는다

문서는 외부 결제 provider를 전제로 하지만 현재 결제는 같은 MongoDB에 곧바로 `Completed` 문서를 넣고, 구매 transaction에도 참여한다. [결제 저장소](../apps/api/src/services/infrastructure/payments/payments.repository.ts#L51), [구매 transaction](../apps/api/src/services/application/purchase/purchase.service.ts#L331)

Mongo outbox와 JetStream이 전달하는 “알림”도 로그 한 줄을 남기고 ack하는 것이 전부다. [구매 알림](../apps/api/src/services/application/purchase/internal/purchase-notification.service.ts#L65)

실제 결제·알림 연동 전에는 lease, reconciliation, outbox, JetStream을 구현할 이유가 없다. 현재 구현은 가상의 외부 시스템을 위해 실제 복잡성을 부담한다.

**  시드니까 외부 결제가 없는 것이고 이건 시드니까 jetstream 예제는 있어야 하니까 넣은 것이다. **

### 5. 인증은 하나의 기능군으로 과도하게 커졌다

- JWT refresh family, 회전, 재사용 탐지, Redis fence와 Lua: 운영 코드 483줄, 테스트 826줄. [JWT 인증](../libs/common/src/auth/jwt-auth.service.ts#L30)
- 모든 인증 요청에서 JWT 검증 후 MongoDB까지 조회해 `authVersion`을 확인한다. [사용자 인증 guard](../apps/api/src/services/gateway/guards/user-auth.guard.ts#L17)
- 두 BFF는 각각 292줄이고 세 개의 상수만 다르며, 63줄 helper도 완전히 중복이다. [Console BFF](../apps/console/src/app/api/%5B...path%5D/route.ts#L11)

같은-origin 검사 같은 일부 보호만 떼어 제거할 문제는 아니다. 쿠키 BFF, refresh 회전, 즉시 계정 철회, IP rate limit을 모두 요구하는지부터 정하고 하나의 단순한 세션 모델로 줄여야 한다.

**  인증은 나도 좀 과해 보인다. 제안을 해봐라 **

### 6. 현재 입력보다 미래 규모를 먼저 설계했다

상영 생성 입력은 극장 20개와 시작 시각 20개, 실제 생성은 최대 200개로 제한돼 있다. 그런데 Restate 도입 설명은 현재 요청으로 도달할 수 없는 9억 건 사고실험을 사용한다. [입력 스키마](../apps/api/src/services/application/showtime-creation/dtos/bulk-create-showtimes.dto.ts#L13), [생성 상한](../apps/api/src/services/application/showtime-creation/internal/showtime-creation-persistence.service.ts#L31), [설명](../docs/apps.md#L139)

허용된 작업에 durable workflow가 필요하다는 측정 근거가 없다. 실무 seed가 목표라면 동기 transaction으로 줄이고 Restate·상태 SSE·Core NATS를 제거하는 쪽을 추천한다.

**  20/20 내가 한거 아니다. 지워도 된다면 지워라 **

### 7. 검증 코드가 계약을 좁히지 않고 오히려 넓힌다

JSON body의 문자열·숫자 필드가 boolean까지 받아 강제 변환한다. 따라서 `password: true`는 `"true"`, `durationInMinutes: true`는 `1`로 통과한다. [문자열 입력](../apps/api/src/services/core/admins/dtos/request-value.schema.ts#L3), [숫자 입력](../apps/api/src/services/application/showtime-creation/dtos/bulk-create-showtimes.dto.ts#L4)

HTTP body는 원래 타입을 엄격히 받고, 문자열 변환은 query에만 한정하는 것이 더 작고 정확하다. Controller에서 변환된 DTO를 repository가 다시 Zod로 검사하는 경로도 한 번으로 줄일 수 있다.

**  예를 들어 설명해라 **

### 8. 명시적으로 미래를 위한 코드와 미사용 코드가 많다

- “나중의 bulk API”를 위해 단건 ID를 매번 배열로 감싼다. [API 규칙](../docs/apps.md#L135)
- 구현하지 않은 `foods` 타입을 enum에 넣고 별도 검증으로 다시 거절한다. [구매 입력](../apps/api/src/services/application/purchase/dtos/create-purchase.dto.ts#L9)
- 배포·migration 근거 없이 legacy payment와 구 토큰 호환 경로가 존재한다. [구매 호환 경로](../apps/api/src/services/application/purchase/purchase.service.ts#L295)
- `Base64`, `ByteUtil`, `Env`, `PathUtil`, `redactSensitive`와 그 테스트 약 911줄은 저장소 런타임에서 사용되지 않는다. 특히 redaction은 로거에 연결되지도 않았다.

**  이게 시드라는 걸 고려한 판단인가? **

### 9. 설명은 중복돼 이미 낡기 시작했다

`.env.infra`는 환경 문서의 “포트 표”를 보라고 하지만 그런 표는 없고, 환경 문서는 오히려 수동 표를 믿지 말라고 한다. [.env.infra](../.env.infra#L7), [환경 문서](../docs/reference/environment.md#L34)

README, apps, decisions, api-stack 문서가 Restate·NATS·reset·BFF 경계를 반복 설명한다. README는 목적·시작 명령·문서 링크만 남기고, 결정 하나는 문서 한 곳만 소유하게 해야 한다.

**  환경 문서? 그거 정리가 필요해 보이더라 **

## 권장 정리 순서

1. 페이지네이션과 삭제 경합 같은 실제 오류부터 수정한다.
2. 자동 volume reset, `free-port`, 과도한 예약 CI를 제거한다.
3. 미사용 코드·가상 알림·vendor Restate 복구 테스트·curl API 문서 하네스를 정리한다.
4. JSON DTO와 단건 API를 현재 요구에 맞게 단순화한다.
5. 마지막으로 저장소를 실무 seed로 확정하고 인증·구매·상영의 분산 설계를 축소한다.

주석을 먼저 일괄 삭제하는 것은 핵심 해결이 아니다. 불필요한 메커니즘을 제거하면 그것을 변호하던 주석과 테스트가 함께 사라진다. 반대로 transaction 내 guard 갱신 순서처럼 코드만으로 알 수 없는 불변식 설명은 남길 가치가 있다.

## 개발용 admin

admin은 엄밀히 Nest 애플리케이션 bootstrap이 아니라 `Dev Container postStart → infra/reset.sh → admin:create`에서 초기화된 개발 DB에 생성되는 고정 최초 관리자다. 현재 `.env.infra` 주석은 그 의미에 맞다.

## 주석 반영 답변

이 절의 결론이 위 최초 검토보다 우선한다. 주석을 확인한 뒤 2·3·4·6번과 8번 일부의 판단을 수정했다.

### 1. 테스트 제목

지침은 읽었지만 실제 제목에 지침이 적용됐는지까지 확인하지 못했다. `describe('CrudRepository')`나 `describe('POST /users')`는 코드 식별자이므로 영어가 맞다. 반면 `describe('insert and mapping')`은 코드 식별자도 아니고 조건도 아닌 영어 분류명이어서 현재 지침에 맞지 않는다. 안쪽 `it`과 이어 읽을 수도 없다.

같은 파일의 `initialization`, `read contracts`, `delete contracts`, `protected helpers`, `transactions`도 같은 문제다. 저장소 다른 곳에도 `ObjectId helpers`, `Mongo document mapping`, `durable purchase state`, `purchase claim`, `test context setup cleanup`, `showtime creation request schemas` 같은 사례가 있다. 영어 제목을 일괄 변경할 문제는 아니다. 클래스·메서드·endpoint는 그대로 두고, 나머지는 정확한 코드 식별자로 묶거나 한국어 조건으로 바꾸는 의미 기반 검토가 필요하다.

조건형 테스트의 정확한 구조는 다음과 같다.

```text
describe('이메일이 이미 존재하면')
├─ beforeEach: 같은 이메일의 사용자를 생성한다
└─ it('409 Conflict를 반환한다')
```

`describe`가 “무엇이면”을 말하고 해당 범위의 `beforeEach`가 그 조건을 구현하며, `it`이 “무엇을 한다/무엇이다”라는 결과를 완성한다. 공유 조건이 없으면 억지로 조건형 `describe`를 만들지 않고 `it`이 행동 전체를 말하면 된다. 여러 테스트를 코드 단위로 묶어야 할 때만 `CrudRepository`, `create`, `POST /users` 같은 정확한 식별자를 `describe`에 쓴다. `insert and mapping` 범위에는 자체 `beforeEach`가 없고 두 정확한 코드 식별자를 가리키지도 않으므로 어느 형태에도 해당하지 않는다.

검토에서 확인한 영어 분류명은 정확한 클래스·메서드·스키마 식별자로 바꿘다. 테스트 조건과 셋업은 바꾸지 않았다.

### 2. Dev Container 초기화

지적이 맞다. 단독 사용하며 폐기 가능한 Dev Container라는 전제에서는 volume 초기화와 컨테이너 안의 포트 프로세스 종료를 문제라고 단정할 수 없다. 작업 자체는 데이터를 지우지만 이 저장소가 의도한 수명주기 안에서는 정상 동작이다. 개발 상태를 보존해야 한다는 별도 요구가 없는 한 `reset`과 `free-port` 제거 제안은 철회한다.

### 3. 테스트와 예약 실행

100% 커버리지 원칙과 그 이유를 읽었는데도 최초 결론에 제대로 반영하지 않았다. 테스트 코드가 운영 코드보다 많다는 사실만으로 과도하다고 할 수 없고, 무료 예약 실행은 반복할수록 확률적인 오류를 발견할 기회가 늘어난다. 현재 실행이 다른 작업을 막거나 의미 없는 동일 실패만 만든다는 증거도 찾지 않았다. 따라서 100% 게이트와 예약 반복 축소 제안, 그리고 “별도 제품”이라는 표현을 철회한다.

남는 문제는 검증량이 아니라 검증의 정확성이다. soft-delete된 문서를 `total`에 포함하는 테스트처럼 잘못된 계약을 고정한 사례와 테스트 제목 지침 위반은 별도로 고쳐야 한다.

### 4. 구매와 JetStream

시드의 학습·참조 목적을 누락한 판단이었다. 외부 결제나 실제 알림 provider가 없어도 outbox와 JetStream의 at-least-once 경계를 보여 주는 예제는 성립한다. README와 설계 문서가 이 예제를 명시적으로 약속하므로 lease·outbox·JetStream 제거 제안은 철회한다. 현재 로그 consumer는 실제 제품 기능이 아니라 후속 consumer를 붙일 자리라는 점만 코드 구조에서 분명하면 된다.

### 5. 인증 간소화 제안

다음 모델을 추천한다.

- access JWT, admin/user 구분, HttpOnly cookie를 쓰는 BFF, 로그인·refresh·logout endpoint는 남긴다.
- refresh JWT family 대신 session ID와 현재 refresh token hash, 사용자 ID·종류·만료 시각을 Redis 한 레코드에 저장한다.
- refresh 시 제시된 token hash가 현재 값과 같은지 확인하고 새 token hash로 원자 교체한다. 새 access token과 refresh token을 함께 발급하므로 회전은 유지한다.
- refresh family, consumed tombstone, 재사용 공격 판정, revoke fence, 동시 refresh의 `409`와 grace timer는 제거한다. 이전 token은 단순히 `401`로 거부하며 현재 session까지 폐기하지 않는다.
- 일반적인 동시 refresh는 BFF의 single-flight로 한 요청에 합친다. 정말 같은 token이 동시에 두 번 들어오면 원자 교체에 성공한 한 요청만 성공한다.
- 모든 인증 요청의 MongoDB `authVersion` 조회를 없앤다. 계정 존재와 version은 refresh 때만 확인한다. 비밀번호 변경·계정 삭제 뒤 기존 access JWT는 현재 만료 시간까지 살아 있을 수 있음을 명시적으로 받아들인다.
- 제품 요구가 없는 `logout-all`과 custom IP/account rate limiter, forwarded-IP 신뢰 설정을 제거한다.
- 이 축소 뒤에도 두 BFF에 의미 있는 중복이 남는지 다시 본다. 먼저 공유 추상화를 추가하지 않는다.

대가는 회전된 예전 token의 재사용을 공격으로 분류해 session 전체를 폐기하지 않고, BFF 밖의 완전히 동시인 refresh 중 하나는 `401`이 된다는 것이다. 계정 변경 직후 access JWT도 즉시 철회하지 못한다. 이 보안 계약이 실제로 허용되는지 결정한 뒤 구현해야 한다.

### 6. 상영 생성의 20/20 제한

각 배열의 `.max(20)`은 제거했다. 실제 작업량은 persistence의 `theaterIds.length × startTimes.length <= 200`에서 계속 제한되고, 상영 하나가 만드는 티켓도 10,000개 상한을 유지한다. 한 배열이 20개를 넘어도 곱이 200 이하면 입력 스키마가 허용하는 테스트를 기존 schema spec에 추가했다.

다만 이것만으로 Restate가 불필요하다는 결론은 나오지 않는다. 시드가 durable workflow 예제를 제공한다는 목적을 고려해 Restate·SSE·NATS 제거 제안도 철회한다.

### 7. 입력 강제 변환의 실제 예

현재 JSON body는 다음처럼 잘못된 타입을 정상 값으로 바꿀 수 있다.

```json
{ "email": "admin@nest-seed.local", "password": true }
```

admin 로그인에서 `password`는 boolean인데도 문자열 `"true"`가 된다.

```json
{
  "durationInMinutes": true,
  "movieId": false,
  "startTimes": ["2100-01-01T09:00:00Z"],
  "theaterIds": ["theater-id"]
}
```

상영 생성에서는 `durationInMinutes`가 `1`, `movieId`가 `"false"`가 된다. JSON body는 이미 number·string·boolean 타입을 구분하므로 이런 요청은 `400`으로 거부하는 편이 맞다. 반면 query string의 `page=2`는 HTTP에서 문자열로 들어오므로 숫자 변환이 필요하다. 따라서 body용 strict schema와 query용 coercion schema를 분리하자는 뜻이다.

repository의 재검증은 별개다. service나 테스트가 repository를 직접 부르는 현재 경계에서는 의미가 있을 수 있으므로, 이를 무조건 한 번으로 줄이자는 제안은 철회한다.

### 8. 시드라는 전제를 반영한 미사용 코드 판단

최초 검토는 서로 다른 항목을 “현재 미사용”이라는 이유로 과하게 묶었다.

- Restate·JetStream과 복수형 service API 규칙은 시드가 보여 주려는 설계 예제이므로 단순한 미사용 코드가 아니다.
- `foods`는 지원 예제가 아니라 enum에는 넣고 즉시 거절하는 입력이었다. 타입·거절 분기·티켓만 고르는 불필요한 filter를 제거했다.
- legacy payment·구 토큰 호환은 실제 migration 예제를 문서와 fixture로 제공하는 것이 아니므로 이 시드에서는 제거 대상이다.
- `redactSensitive`는 logger에 연결되지 않았고, `libs/common`을 런타임 코드로 한정한 문서와도 맞지 않아 제거했다.
- `Base64`, `ByteUtil`, `Env`, `PathUtil`은 사용처가 적다는 이유로 제거하지 않는다. `apps/api`는 런타임 API 교체 영향을 한곳에 두기 위해 대응하는 `common` 유틸을 우선해 사용한다.

따라서 이 항목은 일괄 삭제가 아니라 “시드가 가르치는 예제”, “지원하는 공용 도구”, “근거 없는 호환·미완성 입력”으로 나눠 다시 검토해야 한다.

#### 확인된 legacy 호환 경로와 처리

이는 추측이 아니라 런타임 코드와 전용 테스트가 있는 기능이다. 두 경로 모두 `dd49cba` (`fix: harden auth, purchases, and test isolation`)에서 추가됐다.

결제 호환은 현재 모델보다 오래된 다음 문서를 가정한다.

- `Payment.purchaseRecordId`와 `requiresPurchaseResolution`이 없는 결제
- `PurchaseRecord.status`가 없는 구매 기록
- 결제를 먼저 만들고 나중에 구매 기록에 `paymentId`를 넣던 쓰기 순서

reconciliation은 marker가 없는 결제를 검색하고, `PurchaseRecord.paymentId`로 역조회한 뒤 `purchaseRecordId`를 백필하거나 결제를 취소했다. 이를 위해 있던 `resolveLegacyPayment`, `linkLegacyPayment`, `findResolutionByPaymentId`, 누락된 status를 `completed`로 보는 분기와 raw MongoDB fixture 테스트를 제거했다. 결제의 `purchaseRecordId`는 현재 생성 계약대로 필수 문자열이 됐고, reconciliation은 `requiresPurchaseResolution: true`인 현재 문서만 처리한다.

구 토큰 호환은 `authVersion`을 도입하기 전에 생성된 계정 문서와 JWT를 가정했다. payload schema가 claim 누락과 `null`을 허용하고, 계정 문서나 token에 값이 없으면 version `0`으로 간주했다. user와 admin 양쪽의 fallback과 전용 테스트를 제거했다. 이제 `authVersion`은 계정과 JWT에 모두 필요한 숫자이며, 누락된 payload는 거부한다.

현재 transaction 흐름에서는 만들 수 없는 `Sold + Pending`도 두 테스트가 직접 구성하고 있었다. 그 상태를 복구하기 위해 티켓을 `Sold`에서 `Available`로 되돌리던 `releaseOwnedPurchaseForCompensation`까지 함께 제거했다. 현재 실패 흐름에서는 티켓 판매·구매 완료·결제 해소가 같은 MongoDB transaction에서 rollback되고, reconciliation은 transaction 밖의 Redis claim 해제와 결제 취소만 수행한다. transaction rollback을 검증하는 현재 상태 테스트는 남겼다.

극장 모델에서 `showtimeScheduleVersion`이 없는 기존 문서를 설명하던 migration 주석도 제거했다. 애플리케이션 운영 소스의 `$exists`, nullish fallback, legacy·migration 표현을 다시 검색했으며, 이 저장소가 실제 이전 배포 데이터를 지원하기 위한 런타임 경로는 더 찾지 못했다.

`--legacy` pnpm 배포 옵션, TypeScript legacy decorator metadata와 Date fixture는 애플리케이션 구버전 데이터 호환 경로가 아니므로 이 검토 대상에서 제외했다. 영화 asset owner 재확인은 과거 스키마 호환이 아니라 잘못 연결된 asset을 다른 영화가 삭제하지 못하게 하는 별도 정합성 경계이므로 임의로 제거하지 않았다.

#### 누락 값과 fallback 검색

정리 전 운영 소스에서 `??` 39곳, `defaultTo` 27곳, Zod `.default()` 10곳, `.catch()` 15곳을 확인했다. 한 줄에 여러 형태가 겹치며, 이 수치는 제거 대상의 수가 아니다. 빈 배열 누적, 선택적 query, 기본 connection 이름, pagination 첫 페이지, 실패를 `502`로 변환하는 BFF처럼 현재 API 계약을 구현하는 코드가 대부분이다.

판단 결과는 다음과 같다.

- `AppConfigService`의 환경 변수 기본값 10개를 모두 제거했다. 로그인 제한 3개를 포함한 모든 값을 `.env.api`가 명시하며, 누락하면 부팅 검증이 실패한다. 새 env는 Dev Container를 재생성한 뒤 주입된다.
- 존재하지 않는 이메일에도 user/admin 인증이 더미 bcrypt hash를 계산하는 동작은 유지했다. 이는 누락된 계정을 정상 값으로 복구하지 않고 로그인은 똑같이 실패시키면서, 등록 계정의 비밀번호 오류와 계산 시간을 맞춰 이메일 존재 여부 추측을 어렵게 한다. 구현 부담도 작은 편이라 일반 fallback과 구분했다.
- 미해소 결제가 가리키는 구매 기록이 없을 때 자동으로 결제를 취소하던 처리는 제거했다. 구매 기록 조회가 실패하므로 reconciliation 오류로 기록되고 결제는 미해소 상태로 남는다. 데이터 손상을 임의의 정상 상태로 바꾸지 않는다.
- 영화 생성은 빈 body를 허용하고 문자열·날짜·길이에 sentinel인 `MovieDefaults`를 채운다. 이는 과거 데이터 호환이 아니라 미완성 draft를 먼저 만드는 현재 기능 계약이므로 유지했다. `null`로 표현하면 의미는 더 직접적이지만 null 처리가 여러 소비 코드로 퍼지고, draft/published 모델을 나누면 구조가 더 커진다.

S3 응답의 선택 필드를 빈 목록이나 요청 옵션으로 정규화하는 코드, Map 누적의 `0`·빈 배열, 선택적 pagination·정렬, DI 모듈의 기본 connection 이름, 테스트 반복 횟수 기본값은 누락된 저장 데이터나 실패를 성공으로 바꾸는 fallback이 아니어서 유지 대상으로 분류했다.

#### `redactSensitive`를 제거한 이유

`redactSensitive`는 외부 라이브러리가 아니라 `@mannercode/common`의 내부 함수였다. 객체와 배열을 깊게 복사하면서 `password`, `refreshToken`, `authorization` 같은 이름의 필드를 `[REDACTED]`로 바꾸고, S3 presigned URL과 순환 참조도 별도로 처리했다.

처음 추가됐을 때는 HTTP logger가 요청 body와 응답 payload 전체를 기록했으며, 그 경로에서 이 함수를 실제로 호출했다. 이후 `ce7d88e` (`refactor(logging): omit HTTP payloads from logs`)에서 payload 기록 자체를 제거했지만 함수·공개 export·전용 테스트는 남았다. 현재 logger는 method·route·status·duration과 오류 이름만 기록한다. [성공 로그](../libs/common/src/logger/success-logger.interceptor.ts#L50), [오류 로그](../libs/common/src/logger/exception-logger.filter.ts#L27)

문제의 핵심은 마스킹이 부족한 것이 아니라, 시드가 요청·응답 전체를 로그에 넣은 뒤 그 위험을 막으려고 별도 순회 함수와 테스트를 만든 데 있다. payload를 기록하지 않는 현재 방식이 더 작다. 향후 payload logging을 다시 넣겠다는 계약도 없어 함수·export·전용 테스트를 제거했다. HTTP logger의 동작은 바뀌지 않으며, 서비스 코드가 임의 metadata에 secret을 직접 넣으면 이 함수가 자동으로 막아 주던 구조도 아니었다.

### 9. 환경 문서 정리 결과

`docs/reference/environment.md`에는 다음만 남겼다.

- 각 env 파일이 소유하는 값
- Dev Container 생성 시 주입되며 변경 후 재생성이 필요하다는 규칙
- `--env-file`이 따옴표 제거와 변수 보간을 하지 않는다는 짧은 주의

`reset.sh`와 최초 admin 생성은 `docs/infra.md`, Dev Container 수명주기는 `docs/devcontainer.md`, 외부 테스트의 주입 방식은 테스트 문서가 각각 소유하게 한다. Quick Tunnel 설명은 환경 변수 문서에서 빼고 실제 실행 명령 가까이 둔다. 존재하지 않는 “포트 표” 참조와 같은 내용을 반복한 문단·예시는 제거한다. 정확한 key와 값은 지금처럼 env 파일과 검증 schema가 소유한다.

## MongoDB write concern timeout

현재 MongoDB client의 `writeConcern`은 `w: 'majority'`, `journal: true`, `wtimeoutMS: 5000`이다. `wtimeout`은 primary의 쓰기를 5초 뒤 취소하는 제한이 아니다. primary에는 이미 반영됐지만 5초 안에 과반수의 확인을 받지 못하면 write concern 오류를 반환하며, 이후 복제가 완료될 수도 있다. 따라서 이 오류만으로 쓰기 성공 여부를 확정하거나 자동으로 되돌릴 수 없다.

`wtimeoutMS`를 없애면 결과 불확실성이 사라지는 것이 아니라 과반수를 달성할 수 없을 때 장시간 대기할 수 있다. 5초 제한은 유지한다.

사용자 생성에만 있던 기존 처리는 write concern timeout을 판별한 뒤 같은 이메일을 최대 5초 동안 majority 조회해 성공·충돌을 추정했다. 이는 모든 쓰기에 적용되는 정책이 아니며 한 endpoint만 별도로 복구했다. 해당 polling, 전용 결과 분기와 테스트는 제거한 상태를 유지한다.

공통 transaction helper는 session 수명을 관리하고 `withTransaction()`의 transient transaction 및 불확실한 commit 재시도를 MongoDB driver에 맡긴다. 이 구조가 보여 주는 원칙은 재시도를 각 collection 호출에 반복 구현하지 않고 작업 경계에서 처리하는 것이다. 그렇다고 모든 단건 쓰기를 transaction으로 감싸지는 않는다. transaction commit도 최종 timeout이 날 수 있고 callback 재실행 비용과 제약이 생긴다.

모든 쓰기에 개별 polling, rollback 또는 idempotency 설정을 붙이지 않는다. 전역 자동 재시도와 자동 보상도 이미 반영된 쓰기를 중복 실행하거나 다른 상태를 지울 수 있으므로 도입하지 않는다. 반드시 중복 효과를 막아야 하는 구매·상영 같은 작업만 현재처럼 idempotency key나 operation ID를 사용한다.

향후 공통 전략은 아직 결정하지 않았다. 검토 후보는 직접 발생한 `MongoWriteConcernError`, transaction의 `UnknownTransactionCommitResult`, driver가 `cause`로 감싼 오류를 좁게 분류하고 HTTP·worker 경계에서 같은 “결과 불확실” 오류로 다루는 방식이다. 상태 코드와 클라이언트 재시도 계약, transaction helper의 소유 위치까지 결정한 뒤 구현한다. 이전 사용자별 polling을 공통 기능으로 되살리지는 않는다.

## 이번 처리 결과

- 인증 간소화 제안과 로그인 rate limiter는 구현하지 않았다. 이전에 별도로 합의한 Basic Auth·구 `authVersion` 호환 제거만 반영된 상태다.
- soft-delete pagination `total`, NATS handler 예외 격리, 미지원 `foods`, 확인한 테스트 분류 제목, 환경 문서 소유권을 수정했다.
- 환경 검증 스키마의 기본값을 제거하고 개발 값을 `.env.api`에 명시했다.
- 공용 유틸은 유지한다. `apps/api` 운영 코드의 직접 `JSON.parse`/`JSON.stringify`는 `JsonUtil`로, 필수 `PROJECT_ID` 조회는 `Env`로 통일했다. 해당하는 사용처가 없는 유틸을 쓰기 위해 새 계층을 만들지는 않았다.
- 영화·극장 삭제와 상영 생성의 경합, MongoDB write timeout의 공통 응답 계약, JSON body 암시적 타입 변환은 결정 후 다시 처리한다.
