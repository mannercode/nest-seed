# README 및 `docs/` 문서 검토 보고서

## 높은 우선순위 발견 사항

### DOC-001 — 튜토리얼이 구현되지 않은 시스템 규모를 구현된 것처럼 설명한다

**판정:** 내용 불일치, 요구사항 미충족, 교육적 오해 가능성 높음

[`tutorial.md`](docs/reference/tutorial.md) 13~20행은 영화 하나에 대해 극장 4,000개,
60일, 하루 8회라는 요구사항을 제시한다. 183행 이후에는 이를 192만 showtime과
9억 6천만 ticket으로 계산하고, 이 규모를 202 응답과 workflow 선택의 근거로 삼는다.

실제 구현 제한은 다음과 같다.

- [`bulk-create-showtimes.dto.ts`](apps/api/src/services/application/showtime-creation/dtos/bulk-create-showtimes.dto.ts)
  13~21행: 요청당 시작 시각 최대 20개, 극장 최대 20개
- [`showtime-creation-persistence.service.ts`](apps/api/src/services/application/showtime-creation/internal/showtime-creation-persistence.service.ts)
  15행 및 31~35행: 생성 showtime 최대 200개
- [`showtime-bulk-creator.service.ts`](apps/api/src/services/application/showtime-creation/internal/showtime-bulk-creator.service.ts)
  16행 및 90~98행: 생성 ticket 최대 10,000개

따라서 문서의 192만/9억 6천만 건 요구사항은 현재 API 한 번으로 처리할 수 없다.
이를 나누는 batch coordinator, pagination 또는 job partitioning도 찾을 수 없었다.
좌석 500개라는 튜토리얼 가정대로라면 ticket 제한 때문에 실제 한 작업은 showtime
약 20개부터 제한에 도달한다.

또한 요구사항에 “기존 데이터 migration이 필수”라고 적었지만 이후 설계, 구현,
운영 절차 어디에서도 migration을 다루지 않는다. 영화 등록과 showtime 대량 생성도
실제 API에서는 별도 동작인데 튜토리얼 서술은 두 동작을 하나처럼 읽히게 한다.

MongoDB도 큰 transaction은 작은 batch로 나누도록 권고한다. 공식 가이드는 실무
지침으로 transaction당 수정 문서를 1,000개 이하로 유지하라고 제안한다.
[MongoDB transaction 성능 권고](https://www.mongodb.com/company/blog/technical/performance-best-practices-transactions-and-read-write-concerns)

**권장 조치**

1. 해당 규모가 장래 목표라면 “현재 seed가 구현하지 않은 목표 규모”라고 명시한다.
2. 현재 제한인 `20 × 20`, showtime 200개, ticket 10,000개를 튜토리얼에 표시한다.
3. 전국 규모를 유지하려면 request → partition → bounded transaction → progress
   aggregation 구조를 실제로 설계한다.
4. migration 요구사항을 실제 절차로 연결하거나 제거한다.
5. 202 선택 근거를 가상의 9억 건보다 현재 작업 시간, 재시도, 실패 복구 특성으로
   설명한다.

> 저 정도 예상되는 고성능을 고려해서 설계를 헀다는 의미다. 이건 시드지만 유튜브에서 백엔드 강좌 자료로도 사용했다. 그러니 목표치는 무시해도 된다.
> max(20)을 언제 설정한 거야? 난 안 한거 같은데
> 마이그레이션 필수는 무슨 말이지?

**재검토 답변:** 규모가 실제 endpoint 한 번의 처리량 약속이 아니라, 대규모 시스템을
가정해 API와 비동기 경계를 생각하는 교육용 목표라는 설명을 수용한다. 최초 검토는 이
가정과 현재 batch 제한을 같은 종류의 요구사항으로 취급했다. 규모 불일치 자체는 결함
판정에서 제외한다. 다만 독자가 같은 오해를 하지 않게 “이 수치는 설계 사고를 위한
목표 규모이며 현재 seed의 단일 요청 처리량을 뜻하지 않는다”는 한 문장을 넣는 것은
가치가 있다.

`max(20)`은 2026-08-06의 `10ab4cd`(`fix: make showtime creation retry-safe (#114)`)
커밋에서 `startTimes`와 `theaterIds` 양쪽에 처음 들어왔다. 같은 커밋이 transaction을
도입하면서 showtime 200개와 ticket 10,000개 제한도 함께 추가했다. 2026-08-29의
`7242632c` Zod 전환은 기존 제한을 그대로 옮겼고, 2026-08-30에 `startTimes`의 날짜
schema만 바뀌었다. 따라서 오래된 원 설계가 아니라 retry-safe 작업에서 transaction
크기를 제한하려고 들어온 값이다.

“기존 데이터 migration 필수”는 [`tutorial.md`](docs/reference/tutorial.md) 13~20행에
실제로 적힌 가상 도메인 요구사항이다. 2026-07-05의 `87ea3cb`에서 튜토리얼을 처음
추가할 때 생겼다. 의미는 기존 예매 시스템을 교체한다면 과거 데이터를 보존·이전해야
한다는 것이지만, 이후 설계에는 전혀 사용되지 않는다. seed가 최종 구조만 보여 주는
자료라면 이 문장과 요구사항 3번을 삭제하는 것이 맞고 별도 migration 설계를 추가할
필요는 없다.

> seed가 최종 구조만 보여 주는 자료 맞다. 관련 조치 해라.
> 20x20 제한은 어찌하면 좋겠는가?

### DOC-003 — “로그에 query가 남지 않는다”는 설명이 사실과 다르다

**판정:** 개인정보·운영 문서 오류

[`deploy.md`](docs/deploy.md) 97행은 HTTP 로그에 method, route, status, duration, error
identifier만 남고 body와 query는 기록하지 않는다고 설명한다.

하지만 [`deploy/nginx.conf`](deploy/nginx.conf) 21행과 28행의 로그 형식은
`$request`와 `$request_uri`를 사용한다. 두 값 모두 query string을 포함할 수 있다.
IP, user agent, upstream 정보 등 문서가 열거하지 않은 정보도 기록한다.

이는 단순 표현 문제가 아니라 개인정보나 URL token이 기록되지 않는다는 잘못된
기대를 만들 수 있다.

**권장 조치**

1. NGINX access log에서 `$request_uri` 대신 query를 제외한 `$uri`를 사용한다.
2. `$request` 대신 method와 URI를 별도 필드로 기록한다.
3. 현재 동작을 유지한다면 문서를 “API 애플리케이션 로그에는 body/query를 넣지
   않는다”로 좁히고 NGINX 동작을 별도로 명시한다.
4. query가 로그에 포함되지 않는 전용 NGINX 로그 계약 테스트를 추가한다.

> 다시 설명 부탁

**재검토 답변:** 예를 들어 클라이언트가
`GET /movies?email=a@example.com`을 보낸다고 하자. NGINX 공식 정의에서 `$request`는
전체 원본 request line이므로 `GET /movies?email=a@example.com HTTP/1.1`이 되고,
`$request_uri`는 argument를 포함한 원본 URI이므로 `/movies?email=a@example.com`이
된다. 현재 [`nginx.conf`](deploy/nginx.conf)는 전자를 `message`, 후자를
`url.original`에 기록한다. 즉 같은 query가 access log 한 줄에 두 번 들어간다.
[NGINX 변수 공식 정의](https://nginx.org/en/docs/http/ngx_http_core_module.html#var_request_uri)

API 애플리케이션 로거가 body와 query를 기록하지 않는다는 설명은 맞지만, 문장 주어가
API와 NGINX 전체라서 현재 표현은 틀리다. query를 남기지 않는 것이 의도라면 NGINX를
다음 의미로 바꾸는 것이 정확하다.

- `message`: `$request_method $uri $server_protocol`
- `url.path`: `$uri`
- `url.original`: 제거

NGINX의 `$uri`는 query를 제외한 정규화된 현재 URI다. 다만 NGINX는 Nest의
`/movies/:movieId` 같은 route template을 모르므로 구체적인 URL path만 기록한다.

> 애초에 저런 규칙을 왜 설정했을까? 그리고 난 nginx 로그에 대해선 설정하지 않았다. api의 게이트웨이와 nginx에서 각각 로그를 어떻게 남기고 있지?

## 중간 우선순위 발견 사항

### DOC-005 — 튜토리얼의 public API 설명이 barrel export와 다르다

**판정:** 사실 오류

`tutorial.md` 177행은 `internal/` 서비스가 재수출되지 않으며
`ShowtimeCreationService`와 Events만 public이라고 설명한다.

실제 [`showtime-creation/index.ts`](apps/api/src/services/application/showtime-creation/index.ts)
1~10행은 validator, persistence service, Restate endpoint/client, DTO, error 등을
폭넓게 재수출한다. Nest module의 DI export와 TypeScript barrel export를 혼동한 것으로
보인다.

**권장 조치:** 두 종류의 export를 분리해 설명하거나 barrel을 실제 의도대로 축소한다.

> 저거 과거 temporal 사용했을 때 잔재 같은데 이젠 막아도 될거 같은데 점검해봐

**재검토 답변:** 추측이 맞다. `internal/` 재수출은 2026-05-09의 `f74764d`에서 한 번
제거됐지만, 2026-08-06의 `10ab4cd` retry-safe 작업에서 Temporal legacy activity와
통합 테스트가 내부 persistence·validator에 접근하도록 다시 추가됐다. Restate로 바꾼
2026-08-28의 `92e4dbf`에서는 legacy activity export만 Restate endpoint/client export로
교체되어 공개 범위가 그대로 남았다.

현재 운영 코드에서 모듈 바깥이 사용해야 하는 것은 DTO, error, module,
`ShowtimeCreationService`, `ShowtimeCreationEvents`다. persistence·validator와 Restate
endpoint/client의 barrel 재수출은 API 테스트와 테스트 helper만 사용한다. 따라서 public
barrel에서 제거하고 테스트가 필요한 내부 타입은 명시적인 상대 경로로 가져오도록
바꿔도 된다.

barrel 제거는 우발적인 `#application` import를 막지만 deep import 자체를 금지하지는
않는다. 운영 코드에서 `internal/` 접근까지 막으려면 Oxlint의 restricted import 규칙을
운영 소스에 적용하고 테스트 파일만 예외로 두어야 한다.

> 그렇게 조치해라. 그리고 temporal로 인한 잔재는 정리한 거겠지?

### DOC-006 — “mock 없는 테스트”는 과장된 표현이다

**판정:** 테스트 철학 설명 부정확

[`README.md`](README.md) 24행은 “mock 없는 실제 인프라 테스트”라고 표현한다.
실제 인프라를 적극 사용한다는 핵심은 맞고 가치도 크다. 그러나 정적 검색상 mock 또는
spy 패턴이 있는 테스트 파일이 37개이고 `vi.spyOn`이 약 130회 사용된다.

`tutorial.md` 334행도 내부 호출을 검사하지 않는다고 설명하지만 실제 테스트에는 호출
횟수와 인자를 검증하는 사례가 다수 있다.

> 실제 인프라 대신 목을 사용해서 속도를 올리거나 하지 않는단 얘기다. spy는 특정 값을 제공하거나 결과를 캐치하려고 사용했다. 그거 외에 다른 목적으로 spy 사용한게 있나?

**재검토 답변:** 전체 `vi.spyOn` 133곳을 다시 분류했다. 핵심 통합 경로를 빠르게
만들려고 MongoDB·Redis·S3·NATS·Restate를 mock으로 교체한 흔적은 없다. README 문장의
의도는 타당하다.

다만 spy는 다음 네 목적으로 쓰인다.

1. 호출·결과 관찰: repository write, event emit, payment 호출, logger 호출 횟수와 인자를
   확인한다.
2. 실패·경합 지점 주입: MongoDB write, Redis, NATS, S3, payment, Restate 단계가 특정
   시점에 실패하도록 만든다.
3. 결정적 시간·환경 제어: `Temporal.Now.instant`, `performance.now`, filesystem 오류처럼
   실제로 기다리거나 운영체제 상태를 바꾸기 어려운 조건을 만든다.
4. 출력 가로채기 또는 작은 adapter 단위 격리: Winston transport 출력을 수집하거나
   logger 출력을 억제하고, Restate health의 `fetch`, S3 SDK `send`, NATS iterator 같은
   낮은 수준 응답을 직접 구성한다.

3번과 4번은 “특정 값을 제공하거나 결과를 캐치”의 넓은 범위에는 들어가지만, 좁게 보면
추가 목적이다. 또 `vi.spyOn` 이외에는 Redis Cluster constructor, 인증 내부 repository,
Restate client를 `vi.mock`·`vi.fn`으로 완전히 대체하는 소규모 단위 테스트도 있다.
따라서 “mock을 전혀 쓰지 않는다”는 문자 그대로는 아니고, “실제 인프라 통합 테스트를
속도를 위해 mock 기반으로 대체하지 않는다”가 정확한 원칙이다.

**권장 표현**

실제 인프라를 기본으로 사용하며, 실패 주입과 경계 검증에는 선택적으로 mock과 spy를 사용한다.

> 그냥 사용을 최소화 했다고 하자. 애초에 이런걸 굳이 다 설명해야 하는지 의문이다.

### DOC-007 — RDB를 배제하는 논리가 지나치게 단정적이다

**판정:** 선택은 가능하지만 근거가 false dichotomy에 가까움

[`README.md`](README.md) 12행과 [`decisions.md`](docs/reference/decisions.md) 182~186행은
cross-boundary FK와 join을 사용하지 않으면 RDB의 핵심 가치가 사라지므로 MongoDB를
사용한다는 논리를 편다.

RDB는 cross-service FK가 없어도 transaction, constraint, indexing, query model을
제공하며 서비스별 database 또는 schema ownership과도 양립한다. 현재 구현 자체도
다중 문서 transaction을 중요한 기반으로 사용한다.

> transaction, constraint, indexing, query model 이거 다 mongodb에서 제공하는 거 아닌가?

**재검토 답변:** 맞다. MongoDB는 multi-document transaction, schema validation과
unique index, 여러 종류의 index, find·aggregation query model을 모두 제공한다.
[MongoDB transaction](https://www.mongodb.com/docs/manual/data-modeling/enforce-consistency/transactions/),
[schema validation과 unique index](https://www.mongodb.com/docs/manual/tutorial/unique-indexes-schema-validation/),
[query와 index](https://www.mongodb.com/docs/manual/administration/query/)

내가 열거한 네 기능은 RDB만의 가치가 아니므로 최초 근거가 부정확했다. 구분되는 지점은
관계형 외래 키와 참조 무결성, 정규화된 테이블 사이 join을 중심으로 한 모델, 강한 고정
schema를 기본으로 하는 운영 방식이다. 이 저장소는 그 관계를 서비스 코드가 관리하고
cross-domain FK·join을 의도적으로 쓰지 않으므로 MongoDB 선택 논리는 성립한다.

다만 `RDB가 주는 것이 없다`는 표현만 너무 절대적이다. `이 설계는 RDB의 관계형
강점인 cross-domain FK와 join을 활용하지 않으므로 document 모델이 더 직접적으로
맞는다` 정도면 의도와 사실이 함께 보존된다.

**권장 조치:** MongoDB 선택을 다음 기준의 trade-off로 다시 설명한다.

- 현재 aggregate와 document shape
- 실제 접근 패턴
- schema evolution 방식
- transaction 범위와 제한
- 운영 경험과 인프라 비용
- SQL per service와 비교했을 때 선택한 장단점

> 권장 조치 실행해라.

### DOC-008 — “운영과 같은 토폴로지”라는 표현이 실제 구성보다 강하다

**판정:** 범위 과장

`decisions.md` 141행은 개발 인프라가 운영과 같은 토폴로지를 사용한다고 설명한다.
실제 구성은 Restate와 NATS 단일 인스턴스, Redis replica 없음, 개발용 자격증명,
TLS 없음 등 운영 HA 토폴로지와 다르다. [`infra.md`](docs/infra.md) 15~17행도 이 제한을
일부 명시한다.

**권장 표현:** “운영에서 중요한 일부 protocol과 failure mode를 재현한다.”

> 유사하다고 해

**재검토 답변:** 동의한다. `인프라 토폴로지도 운영과 같게 둔다`를 `인프라
토폴로지도 운영과 유사하게 둔다`로 바꾸면 된다. 이어지는 문장이 실제로 유지하는
특성인 MongoDB Replica Set과 Redis Cluster를 설명하므로 추가 문단은 필요 없다.

> 그렇게 해라.

### DOC-010 — API 문서는 실행 가능하지만 완전한 API 계약은 아니다

**판정:** 접근 방식은 가치 있으나 계약 범위가 제한적

API 문서 테스트가 controller와 실제 요청을 실행한다는 점은 매우 좋다. 정적 대조 결과
일반 controller route는 대부분 포함되며 SSE 제외도 문서에 명시되어 있다.

다만 생성 결과가 `_output/docs`에만 있고 ignore되므로 clone 직후에는 읽을 수 없다.
또 다음 항목이 안정적인 계약으로 남지 않는다.

- request/response schema
- 인증 조건
- 공통 오류 형식
- query semantics
- SSE
- client 생성이 가능한 machine-readable artifact

OpenAPI와 실행 가능한 contract test는 양자택일이 아니다. 현재 실행 테스트를 유지하면서
OpenAPI 또는 별도 JSON contract를 생성하고 검증할 수 있다. `decisions.md` 235행의
“Swagger를 쓰지 않는다”는 결정보다 필요한 계약 특성을 먼저 정의하는 편이 좋다.

> 실행 가능한 api를 프론트개발자에게 전달하면 직접 실행해서 req/res 등의 값을 확보하라는 의도다.

**재검토 답변:** 그 의도라면 OpenAPI나 커밋된 정적 산출물이 없다는 점은 결함이 아니다.
내가 [`apps.md`](docs/apps.md) 711~717행의 실제 응답 로그와 `summary.json` 산출물까지
확인하고도, 이를 정적 계약과 비교하는 관점으로만 평가했다. 소비자가 Dev Container에서
spec을 직접 실행해 현재 서버의 request/response를 얻는 것이 계약이라는 설명을
수용하며 이 지적은 철회한다.

현재 문서에도 실행법과 산출물은 이미 있다. 오해 방지가 필요하다면 “프론트엔드
개발자는 이 spec을 직접 실행해 현재 API의 실제 요청·응답을 확보한다”는 한 문장만
추가하면 충분하다.

> 그렇게 해라.

### DOC-011 — 일회성 migration 지침이 일반 배포 문서에 섞여 있다

**판정:** 문서 위치와 생명주기 부적절

[`deploy.md`](docs/deploy.md) 129~133행의 `authVersion`과 purchase state machine 최초 배포
절차는 특정 시점의 migration runbook이다. 날짜, 적용 버전, 완료 여부가 없어 시간이
지나면 현재도 적용해야 하는 규칙인지 판단할 수 없다.

**권장 조치:** 버전별 migration 문서, 개별 ADR 또는 changelog로 옮기고 적용 상태와
rollback 조건을 기록한다.

> 버전별 마이그레이션 문서를 유지해야 하나? 이건 시드인데 최종만 남겨야 하지 않나?

**재검토 답변:** 맞다. seed는 과거 버전에서 순차 업그레이드하는 제품이 아니라 새
프로젝트의 최종 시작점이므로 버전별 migration 문서를 유지할 이유가 없다. 최초 권장은
과했다.

반대로 [`deploy.md`](docs/deploy.md) 129~~133행의 `authVersion`·구매 상태 머신 “최초
도입 버전” 절도 과거 revision에서 업그레이드할 때만 필요한 내용이다. 최종 상태만
남긴다는 원칙이라면 이 절을 삭제하는 것이 일관된다. Restate endpoint revision을
안전하게 전환하는 115~~127행은 현재 시스템의 일반 운영 특성이므로 별개로 유지한다.

> 그 절은 삭제해라.

## 빠진 문서와 기준

### DOC-017 — migration과 versioning 전략이 없다

튜토리얼은 migration을 요구하지만 schema/data migration 도구, 실행 순서, rollback,
mixed-version 호환 정책이 없다. “production base”를 표방한다면 최소한 non-goal인지
향후 도입 대상인지 명시해야 한다.

> 튜토리얼은 migration을 요구하지만이라고 했는데 이게 무슨 말인가?

**재검토 답변:** [`tutorial.md`](docs/reference/tutorial.md) 13행의 “기존 데이터는
유지해야 한다”와 19행의 “기존 데이터 마이그레이션 필수”를 가리킨 말이다. 내가 새로
추론한 요구사항은 아니다. 다만 이 가상 요구사항은 이후 튜토리얼과 seed 구현에서 전혀
사용되지 않는다. DOC-001 답변처럼 해당 두 표현을 삭제하면 끝나며, 별도 migration과
versioning 전략 문서는 필요 없다. 이 항목은 철회한다.

> 삭제해

## 재검토 후 실행 결과

1. **Gateway 삭제 조정 이동 — 완료.** `application/catalog-management`를 추가해
   영화·극장 삭제의 상영 참조 확인과 삭제를 조정한다. Gateway는 해당 메서드만
   호출한다. 삭제와 동시 showtime 생성 race 보장은 이 변경에 포함하지 않았다.
2. **NGINX query 제거 — 완료.** access log의 `$request`·`$request_uri`를 제거하고
   `$request_method $uri $server_protocol`과 `url.path`를 사용한다. query가 다시
   들어오는 설정을 막는 전용 Node 계약 테스트도 추가했다.
3. **showtime-creation 공개 경계 축소 — 완료.** public barrel에서 internal·worker
   재수출을 제거했다. 테스트는 내부 `index.js`를 명시적으로 사용하고, 운영 코드의
   같은 deep import는 Oxlint가 거부한다.
4. **사용되지 않는 과거 문구 제거 — 완료.** 튜토리얼의 기존 데이터 migration
   요구사항과 `deploy.md`의 일회성 최초 upgrade 절을 삭제했다.
5. **표현 조정 — 완료.** 토폴로지는 “운영과 유사한”으로, RDB 선택과 테스트 설명은
   각각 관계 모델을 적극 사용하지 않는다는 판단과 mock 사용 최소화로 좁혔다.
6. **명확화 — 완료.** 튜토리얼의 규모가 교육용 목표이며 단일 요청 처리량이 아님을
   명시했고, 프론트엔드 개발자가 실행 가능한 API spec에서 실제 request/response를
   얻는다는 설명을 추가했다. `20 × 20` 입력 제한과 transaction의 200 showtime·10,000
   ticket 안전 상한은 retry-safe 작업 단위를 제한하는 보호 장치라서 유지했다.

검증은 API 타입 검사·Oxlint·Prettier, NGINX 설정 문법과 로그 계약 테스트, 내부 문서
링크 검사로 수행했다. API 전체 43개 파일·458개 테스트와 statements·branches·functions·
lines 100% coverage gate도 통과했다.

문서 대규모 분할, 비파괴 infra 명령, 버전별 migration 문서, 별도 production readiness
문서, 개별 ADR 체계는 이번 재검토의 작업 대상에서 제외한다.
