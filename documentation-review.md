# README 및 `docs/` 문서 검토 보고서

> 이 문서는 검토 의견을 논의하기 위한 초안이다. 주석이나 후속 변경에서 각 항목을
> `DOC-001` 같은 ID로 지칭하면 된다.

| 항목          | 값                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------- |
| 검토일        | 2026-09-02                                                                                   |
| 주석 재검토일 | 2026-09-03                                                                                   |
| 기준 revision | `298dc8138c26` 및 검토 시점의 작업 트리                                                      |
| 대상          | 루트 `README.md`, `docs/**/*.md`                                                             |
| 검토 관점     | 사실성, 코드·설정 일치 여부, 가치, 중복, 배치, 독자 적합성, 유지보수성, 운영·보안 위험, 누락 |
| 문서 변경     | 이 보고서 외 기존 문서·코드 변경 없음                                                        |

## 결론

문서의 기술적 가치는 높다. 특히 분산 일관성, idempotency, NATS·Restate 경계,
실제 인프라 기반 테스트, Dev Container 보안 주의사항은 일반적인 seed 프로젝트보다
훨씬 충실하다.

다만 현재 상태를 **코드와 정확히 일치하는 신뢰 가능한 기준 문서**라고 보기는 어렵다.
중요한 요구사항·아키텍처 규칙·로그 개인정보·초기화 명령에서 문서와 구현이 충돌한다.
가장 큰 문제는 정보 부족보다 강한 단정이 실제 코드보다 앞서 나간다는 점이다.

- 높은 우선순위: 튜토리얼 규모, 계층 규칙, 로그 개인정보, 파괴적 reset
- 중간 우선순위: 내부 공개 범위, mock 표현, DB 선택 논리, 운영 토폴로지,
  API 계약, 문서 배치와 중복
- 낮은 우선순위: 표현, 탐색성, 독자 경험, 장기 유지보수 문제

## 검토와 검증 범위

다음 항목을 직접 확인했다.

- [`README.md`](README.md)와 `docs/` 전체 약 2,200줄을 코드·설정·테스트와 대조했다.
- `pnpm run lint:root`가 통과했다.
    - Prettier 통과
    - Markdown 링크 359개 검사, 오류 0개
    - 외부 링크 등 24개는 offline 검사에서 제외
    - shell lint 통과
- 최신 작업 트리에서 `pnpm run test:tools`의 루트 도구 테스트가 모두 통과했다.
- `pnpm run test`의 8단계가 모두 통과했다.
    - API: 43개 파일, 457개 테스트
    - 대상 코드의 statements, branches, functions, lines coverage가 모두 100%
- 문서 설명과 같이 기본 `test`에서 e2e, 실제 race, deploy, benchmark는 제외된다.
- `atoz`, deploy, e2e, 실제 race, benchmark 자체는 이번 검토에서 실행하지 않았다.

따라서 본 보고서의 테스트 평가는 기본 검증 경로에 한정한다. 운영 배포 가능성이나
실제 부하·장시간 안정성까지 검증했다는 의미는 아니다.

## 심각도 기준

- **높음**: 문서를 따라 설계·운영하면 잘못된 구현, 데이터 손실, 보안·개인정보 오해로
  이어질 수 있다.
- **중간**: 즉각적인 사고 가능성은 작지만 유지보수, 교육, 확장, 문서 신뢰도를
  유의미하게 떨어뜨린다.
- **낮음**: 표현과 탐색성 문제 또는 장기적으로 drift를 만들 가능성이 있는 문제다.

## 주석 반영 재검토 요약

| 항목        | 재검토 결과                                                                             |
| ----------- | --------------------------------------------------------------------------------------- |
| DOC-001     | 규모 목표에 대한 지적은 철회. `max(20)` 도입 이력과 사용되지 않는 migration 문구만 설명 |
| DOC-002     | Application namespace 지적은 철회. Gateway의 cross-Core 삭제 조정만 실제 오류로 유지    |
| DOC-003     | 유지. NGINX가 query를 두 필드에 기록하는 사실을 구체적으로 설명                         |
| DOC-004     | 높은 심각도 판정과 비파괴 명령 추가 권고를 철회                                         |
| DOC-005     | 유지. 과거 Temporal 전환기의 재수출이며 현재 축소 가능                                  |
| DOC-006     | “통합 테스트를 mock으로 대체하지 않는다”는 의도는 타당. 실제 spy 용도를 세분화          |
| DOC-007     | MongoDB도 열거한 기능을 제공한다는 지적을 수용. 절대적인 RDB 표현만 완화 권고           |
| DOC-008     | “운영과 유사한 토폴로지”로 표현 수정                                                    |
| DOC-009     | 해결됨                                                                                  |
| DOC-010     | 실행 가능한 문서를 소비자가 직접 실행한다는 의도를 수용하고 지적 철회                   |
| DOC-011     | 버전별 migration 문서 권고 철회. seed에 남은 과거 upgrade 문구 삭제만 권고              |
| DOC-013·014 | 문서 책임과 중복에 대한 지적 대부분 철회                                                |
| DOC-017     | DOC-001의 사용되지 않는 가상 요구사항과 같은 내용. 별도 전략 문서 권고 철회             |
| DOC-018     | production non-goal이 이미 한곳에 정리되어 있어 지적 철회                               |
| DOC-020     | 용어만 설명. 현재 `decisions.md` 구조면 별도 ADR 체계 불필요                            |

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

### DOC-002 — Application·Core·Gateway 계층 규칙이 실제 코드와 충돌한다

**판정:** 아키텍처 문서와 구현 불일치

[`apps.md`](docs/apps.md) 99~108행은 다음 원칙을 명시한다.

- Core 하나만 호출하면 Gateway가 Core를 직접 호출한다.
- 여러 Core를 조합할 때만 Application을 사용한다.
- 전달만 하는 Application은 만들지 않는다.

> 이건 gateway가 반드시 application을 거쳐야 할 필요가 없다는 의미다. showtime-creation은 여러 서비스를 조합하는 중이기도 하고 검색을 할 때도 값을 변환/추가 작업 등을 한다.

**재검토 답변:** 맞다. 최초 검토는 메서드 하나씩만 보고 Application 존재 이유를
판단했다. 경계는 메서드가 아니라 `showtime-creation` 모듈 전체를 기준으로 봐야 한다.
실제로 `searchMoviesPage`는 기본 정렬을 추가하고 `searchShowtimes`는 현재 이후의
상영으로 범위를 제한한다. `searchTheatersPage`가 현재 단순 전달이어도 같은 관리자
화면 namespace의 계약을 한 Application 서비스에 모으는 것은 일관된 설계다. 이 부분의
지적은 철회한다.

그러나 실제 [`showtime-creation.service.ts`](apps/api/src/services/application/showtime-creation/showtime-creation.service.ts)
109~121행에는 Core 하나로 전달하는 검색 메서드가 여러 개 있다.

반대로 여러 Core가 관여하는 삭제 조정은 Application이 아니라 controller에 있다.

- 영화 삭제: [`movies.http-controller.ts`](apps/api/src/services/gateway/movies.http-controller.ts)
  49~58행
- 극장 삭제: [`theaters.http-controller.ts`](apps/api/src/services/gateway/theaters.http-controller.ts)
  41~50행

> 이건 명백한 오류다. gateway에서는 단순 호출만 해야 한다.

**재검토 답변:** 동의한다. 영화와 극장 controller는 Core 두 개를 직접 조합하므로
Gateway가 HTTP 변환 이상의 판단을 하고 있다. 현재 작업 트리에 추가된 TODO는 문제를
표시할 뿐 동작은 그대로다. 삭제 가능 여부 확인과 삭제를 Application 서비스로 옮기고
controller는 그 메서드 하나만 호출하게 해야 한다.

다만 계층 이동만으로 “존재 확인 직후 다른 요청이 showtime을 생성하는” race가
해결되지는 않는다. 계층 오류 수정과 동시성 보장은 별도 작업으로 구분해야 한다.

즉 문서가 금지한 구조와 권장한 구조가 모두 반대로 구현된 부분이 있다.

영화 삭제는 concurrency 검토도 필요하다. “상영 일정 존재 확인 → 영화 삭제”가 하나의
공통 transaction이나 guard write로 묶이지 않아, 동시 showtime 생성과 경합할 때
invariant가 보장되는지 코드상 명확하지 않다. 이는 확인된 race 결함이라는 판정이
아니라, 문서가 약속하는 불변식이 transaction 구조나 race test로 입증되지 않았다는
지적이다.

또 문서는 정적 계층 검증이 없음을 인정하지만 `apps.md` 75행, README의 서술은 순환과
경계 침범을 원천적으로 방지하는 것처럼 읽힌다.

**권장 조치**

1. 현재 의도에 맞는 계층 의존성 표를 하나로 확정한다.
2. cross-Core 삭제 조정을 Application으로 이동하거나 controller 조정을 공식 예외로
   문서화한다.
3. namespace 제공 목적의 pass-through Application을 허용한다면 예외 규칙으로 명시한다.
4. import boundary를 Oxlint나 별도 dependency rule로 검증한다.
5. 영화 삭제 대 showtime 생성 race test를 추가한다.

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

### DOC-004 — `infra/reset.sh`의 파괴성이 충분히 드러나지 않는다

**판정:** 데이터 손실 가능성이 있는 운영 안내 부족

[`README.md`](README.md) 35행과 [`infra.md`](docs/infra.md)는 개발 인프라 초기화
명령으로 `bash infra/reset.sh`를 안내한다. 그러나 [`infra/reset.sh`](infra/reset.sh)
17행은 `docker compose down -v -t 0`을 실행한다.

따라서 이 명령은 단순 재시작이 아니라 MongoDB, Redis, S3, NATS, Restate 등 개발
상태를 폐기하고 다시 만든다. Dev Container의 `postStartCommand`에도 연결되어 있어
컨테이너를 다시 열 때마다 실행된다.

`infra.md`가 NATS와 Restate 초기화는 일부 설명하지만 전체 데이터 삭제라는 효과가
충분히 눈에 띄지 않는다.

**권장 조치**

1. 모든 호출 지점에 “전체 개발 데이터 삭제 후 재생성”이라고 명시한다.
2. 비파괴적인 `infra/up.sh` 또는 `docker compose up -d` 경로와 분리한다.
3. Dev Container 재시작과 데이터 초기화를 자동으로 결합할 필요가 있는지 재검토한다.

> 로컬 개발환경이다. 굳이 안내해야 할까?

**재검토 답변:** 별도 비파괴 명령까지 만들 필요는 없다. `reset`이라는 이름이고,
[`infra.md`](docs/infra.md)도 Restate journal과 NATS stream이 지워진다고 이미
설명한다. 폐기 가능한 로컬 개발 인프라라는 전제를 고려하면 최초의 “높음” 판정은
과했다. MongoDB와 S3 데이터도 함께 지워진다는 한 문장은 친절할 수 있지만 필수 수정은
아니다. 이 항목과 `infra/up.sh` 추가 권고는 철회한다.

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

### DOC-009 — 공유 PlantUML 컨테이너의 lifecycle 소유권이 불명확하다 — 해결됨

추가 조치가 필요 없다.

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

## 중복과 문서 배치

### DOC-013 — `docs/apps.md`가 너무 많은 책임을 가진다

**판정:** 문서 이름과 실제 내용 불일치, 탐색성 저하

[`apps.md`](docs/apps.md)는 약 733줄 안에 다음을 모두 담고 있다.

- 계층 아키텍처
- 분산 일관성
- 코드 작성 규칙
- 테스트 작성법
- 테스트 인프라
- API 문서 작성법
- frontend와 BFF

따라서 `apps.md`라는 이름만으로 내용을 예측하기 어렵고 `reference/conventions.md`,
`tests.md`, `decisions.md`와 책임이 겹친다.

> apps에 책임이 몰리는 건 어쩔 수 없다. tests.md에서 테스트 하는 것과 api에서 테스트 하는 건 다른 항목이다. 각각 설명하는게 맞다.
> decisions.md와 conventions.md와 겹치는 게 뭔가?

**재검토 답변:** 다시 구분해 보니 이 지적은 대부분 철회해야 한다.

- `apps.md`의 테스트 절은 `apps/api` 안의 단위·통합 테스트 구조, fixture, 자원 격리,
  API 문서 작성법을 설명한다.
- `docs/tests.md`는 배포된 stack을 밖에서 검증하는 race, benchmark, browser e2e,
  stability를 설명한다.
- `tests/README.md`는 루트 runner의 실행 범위와 결과 위치를 설명한다.

주제가 모두 “테스트”라는 이유만으로 중복으로 본 것은 잘못이었다. 실행 계층과 독자가
다르므로 각각 설명하는 것이 맞다.

`reference/conventions.md`도 실제로는 겹치지 않는다. 3행에서 애플리케이션 코드 규칙은
`apps.md`가 소유한다고 명시하고, 자신은 commit message, fail-fast, 값 배치, 루트 pnpm
script처럼 저장소 전체 약속만 다룬다.

`decisions.md`와 `apps.md`에는 다음과 같은 의도적인 요약 중복이 있다.

- lock: `decisions.md` §1은 선택 기준과 대안을, `apps.md` 164행 이후는 실제 API와
  사용 위치를 설명한다.
- NATS: `decisions.md` §2는 Redis·Kafka와 비교한 선택 이유를, `apps.md` 177행 이후는
  Core pub/sub과 JetStream의 현재 흐름을 설명한다.
- Restate: `decisions.md` §3은 선택 이유와 trade-off를, `apps.md` 207행 이후는 step,
  retry, transaction, SSE 동작을 설명한다.
- View: `decisions.md` §4는 GraphQL·frontend 조립 대안을, `apps.md` 79행 이후는 계층
  규칙과 실제 호출 방향을 설명한다.

각 쌍은 서로 링크하고 있고 `decisions.md`는 “왜”, `apps.md`는 “어디서 어떻게”라는
경계가 실제로 지켜진다. 따라서 `apps.md`가 길다는 사실만으로 분할할 필요는 없다.

### DOC-014 — 동일 개념의 canonical owner가 불명확하다

| 주제                            | 현재 반복 위치                                    | 권장 기준 문서                           |
| ------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| lock, NATS, Restate, View       | README, apps, decisions                           | architecture에는 흐름, ADR에는 선택 이유 |
| Restate 등록, force, versioning | apps, infra, deploy, environment, tests           | 운영 문서 하나, 나머지는 링크            |
| 테스트 범위, coverage, report   | README, apps, docs/tests, tests/README, decisions | docs/tests 또는 tests/README 하나        |
| 코드 규칙                       | apps, conventions, tutorial                       | conventions 하나                         |
| API 문서 생성                   | README, apps, tests                               | API docs 전용 문서                       |

Restate의 immutable deployment와 revision/draining 설명 자체는 공식 운영 모델과 잘
맞는다. [Restate 공식 versioning 문서](https://docs.restate.dev/services/versioning)
문제는 정확성이 아니라 설명이 여러 위치에 복제되어 향후 drift하기 쉽다는 점이다.

> 다시 자세히 설명

**재검토 답변:** 최초 표는 “같은 단어가 여러 문서에 있다”는 사실을 “기준 문서가
불명확하다”로 과도하게 해석했다. 현재 기준은 이미 다음처럼 구분된다.

| 기준 문서                                     | 실제 책임                                 |
| --------------------------------------------- | ----------------------------------------- |
| `README.md`                                   | 첫 진입, 핵심 특징 요약, 다른 문서로 안내 |
| `docs/apps.md`                                | 애플리케이션 구조와 구현·테스트 방법      |
| `docs/reference/decisions.md`                 | 도구와 구조를 선택한 이유, 검토한 대안    |
| `docs/reference/conventions.md`               | 저장소 전체에 적용되는 개발 약속          |
| `docs/tests.md`                               | 배포 stack 대상의 무거운 테스트           |
| `tests/README.md`                             | 테스트 runner 사용법과 결과 위치          |
| `docs/infra.md`·`deploy.md`·`devcontainer.md` | 각 실행 환경의 구성과 운영 방법           |

Restate 등록이 여러 문서에 나오는 것도 같은 내용을 복사한 것이 아니라 각 경로의
동작을 설명하기 위해 필요하다. `infra.md`는 개발 등록, `deploy.md`는 검증 stack 등록과
운영 전환, `tests.md`는 race·benchmark 등록, `environment.md`는 URL과 변수 흐름을
설명한다. 이 정도의 문맥 반복은 제거하면 오히려 문서를 따라가기 어려워진다.

따라서 canonical owner가 불명확하다는 판정과 별도 디렉터리 재구성 권고는 철회한다.
향후 실제 문장이 복사되어 서로 다른 수치나 정책을 말하게 될 때만 개별적으로 줄이면
된다.

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

### DOC-018 — production readiness와 non-goals가 한곳에 정리되어 있지 않다

TLS, secret 관리, backup/restore, HA, observability, frontend 배포, disaster recovery
제약이 여러 문서에 흩어져 있다. 배포 전에 확인할 수 있는 단일 checklist가 필요하다.

> 어디어디에 있다는 건가?

**재검토 답변:** 다시 확인하면 핵심 non-goal은 이미 한곳에 모여 있다.

- [`README.md`](README.md) 85행: TLS, secret 관리, backup, frontend 배포가 없는 검증용
  참고 stack이라고 요약한다.
- [`deploy.md`](docs/deploy.md) 3행: TLS, secret manager, backup/recovery, monitoring,
  zero-downtime orchestration, console/user-app 배포를 별도 설계 대상으로 한 번에 적는다.
- `deploy.md` 101~113행: frontend BFF와 trusted edge/IP 경계를 설명한다.
- `deploy.md` 115~127행: Restate 운영 version 전환의 제한을 설명한다.
- [`infra.md`](docs/infra.md) 15~17행: Restate와 NATS가 개발용 단일 instance이며 HA가
  아님을 설명한다.
- [`environment.md`](docs/reference/environment.md) 114~130행: 운영 secret과 Quick
  Tunnel 공개 경계를 설명한다.

세부 설명이 각 소유 문서에 나뉜 것은 적절하고, `deploy.md` 첫 문단이 단일 checklist
역할까지 이미 한다. disaster recovery가 별도로 없다는 이유만으로 seed에 새 production
readiness 문서를 요구한 것은 과했다. 이 항목은 철회한다.

### DOC-020 — ADR 메타데이터와 생명주기가 없다

현재 단일 `decisions.md`에는 결정 상태, 날짜, owner, superseded-by, 검증 근거가 없다.
변경 가능성이 큰 결정은 개별 ADR로 분리하는 것이 적절하다.

> adr이 뭔가?

**재검토 답변:** ADR은 Architecture Decision Record의 약자다. 중요한 기술 결정을
“당시 맥락 → 선택 → 이유 → 대안 → 결과” 형태로 한 건씩 기록하는 짧은 문서다. 보통
`0001-use-mongodb.md`처럼 번호를 붙이고 상태(`accepted`, `superseded`)와 날짜를 둔다.

하지만 현재 [`decisions.md`](docs/reference/decisions.md)는 이미 각 절마다 결정, 근거,
검토한 대안을 갖춰 ADR의 핵심 역할을 한다. 여러 버전의 결정을 장기간 추적하는 제품
저장소라면 개별 ADR과 상태가 유용하지만, 최종 선택만 보여 주는 seed에서는 파일과
메타데이터만 늘어날 수 있다. 현재 형식을 유지하는 것이 더 낫고 이 권고는 철회한다.

## 재검토 후 남은 작업 후보

주석을 반영하면 실제 변경 후보는 다음으로 좁혀진다. 아직 이 보고서에서는 관련
코드·문서를 수정하지 않았다.

1. **Gateway 삭제 조정 이동** — 영화·극장 삭제의 cross-Core 검증을 Application으로
   옮긴다. 삭제와 동시 showtime 생성 race 보장은 별도 설계로 다룬다.
2. **NGINX query 제거** — `$request`·`$request_uri` 대신 query 없는 `$uri` 중심의 ECS
   필드를 쓰고 전용 로그 계약 테스트를 둔다.
3. **showtime-creation 공개 경계 축소** — 과거 Temporal 작업에서 생긴 internal과
   worker 재수출을 제거하고, 운영 코드의 deep import를 lint로 막을지 결정한다.
4. **사용되지 않는 과거 문구 제거** — 튜토리얼의 기존 데이터 migration 요구사항과
   `deploy.md`의 `authVersion`·구매 상태 머신 최초 upgrade 절을 삭제한다.
5. **표현만 조정** — “운영과 같은”을 “운영과 유사한”으로 바꾸고, RDB와 mock 관련
   문장은 의도를 유지하면서 절대적인 표현만 완화한다.
6. **선택적 명확화** — 튜토리얼 규모가 교육용 목표임을 밝히고, 프론트엔드 개발자가
   실행 가능한 API spec을 직접 실행하는 계약임을 한 문장씩 추가한다.

문서 대규모 분할, 비파괴 infra 명령, 버전별 migration 문서, 별도 production readiness
문서, 개별 ADR 체계는 이번 재검토의 작업 대상에서 제외한다.
