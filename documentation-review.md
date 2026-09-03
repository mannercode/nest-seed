# README 및 `docs/` 문서 검토 보고서

> 이 문서는 검토 의견을 논의하기 위한 초안이다. 주석이나 후속 변경에서 각 항목을
> `DOC-001` 같은 ID로 지칭하면 된다.

| 항목          | 값                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------- |
| 검토일        | 2026-09-02                                                                                   |
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
- 최신 작업 트리에서 `pnpm run test:config`의 22개 테스트가 모두 통과했다.
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
<!-- max(20)을 언제 설정한 거야? 난 안 한거 같은데 -->

또한 요구사항에 “기존 데이터 migration이 필수”라고 적었지만 이후 설계, 구현,
운영 절차 어디에서도 migration을 다루지 않는다. 영화 등록과 showtime 대량 생성도
실제 API에서는 별도 동작인데 튜토리얼 서술은 두 동작을 하나처럼 읽히게 한다.
<!-- 마이그레이션 필수는 무슨 말이지? -->

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

### DOC-002 — Application·Core·Gateway 계층 규칙이 실제 코드와 충돌한다

**판정:** 아키텍처 문서와 구현 불일치

[`apps.md`](docs/apps.md) 99~108행은 다음 원칙을 명시한다.

- Core 하나만 호출하면 Gateway가 Core를 직접 호출한다.
- 여러 Core를 조합할 때만 Application을 사용한다.
- 전달만 하는 Application은 만들지 않는다.

그러나 실제 [`showtime-creation.service.ts`](apps/api/src/services/application/showtime-creation/showtime-creation.service.ts)
109~121행에는 Core 하나로 전달하는 검색 메서드가 여러 개 있다.

반대로 여러 Core가 관여하는 삭제 조정은 Application이 아니라 controller에 있다.

- 영화 삭제: [`movies.http-controller.ts`](apps/api/src/services/gateway/movies.http-controller.ts)
  49~58행
- 극장 삭제: [`theaters.http-controller.ts`](apps/api/src/services/gateway/theaters.http-controller.ts)
  41~50행

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
4. import boundary를 Oxlint, 별도 dependency rule 또는 configuration contract test로
   검증한다.
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
4. query가 로그에 포함되지 않는 configuration contract test를 추가한다.

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

### DOC-006 — “mock 없는 테스트”는 과장된 표현이다

**판정:** 테스트 철학 설명 부정확

[`README.md`](README.md) 24행은 “mock 없는 실제 인프라 테스트”라고 표현한다.
실제 인프라를 적극 사용한다는 핵심은 맞고 가치도 크다. 그러나 정적 검색상 mock 또는
spy 패턴이 있는 테스트 파일이 37개이고 `vi.spyOn`이 약 130회 사용된다.

`tutorial.md` 334행도 내부 호출을 검사하지 않는다고 설명하지만 실제 테스트에는 호출
횟수와 인자를 검증하는 사례가 다수 있다.

**권장 표현**

> 실제 인프라를 기본으로 사용하며, 실패 주입과 경계 검증에는 선택적으로 mock과
> spy를 사용한다.

### DOC-007 — RDB를 배제하는 논리가 지나치게 단정적이다

**판정:** 선택은 가능하지만 근거가 false dichotomy에 가까움

[`README.md`](README.md) 12행과 [`decisions.md`](docs/reference/decisions.md) 182~186행은
cross-boundary FK와 join을 사용하지 않으면 RDB의 핵심 가치가 사라지므로 MongoDB를
사용한다는 논리를 편다.

RDB는 cross-service FK가 없어도 transaction, constraint, indexing, query model을
제공하며 서비스별 database 또는 schema ownership과도 양립한다. 현재 구현 자체도
다중 문서 transaction을 중요한 기반으로 사용한다.

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

### DOC-009 — 공유 PlantUML 컨테이너의 pin 보장이 완전하지 않다 — 해결됨

**최초 판정:** 문서 표현보다 실행 재현성이 약함

검토 도중 사용했던 초기 구현은 `initialize-docker.sh`에서 이름이 `plantuml`인
컨테이너가 존재하면 image, digest, label을 검사하지 않고 그대로 재사용했다. 그
상태에서는 이전 버전 컨테이너가 계속 재사용되거나 서로 다른 clone의 pin이 충돌할 수
있었다.

**현재 상태:** 후속 변경에서 해당 script를 제거하고
[`compose.plantuml.yml`](.devcontainer/compose.plantuml.yml)을 단일 Compose 선언으로
교체했다. `initializeCommand`는 사용자명과 workspace basename으로 구분한 네트워크를
Dev Container 생성 전에 한 번 확보하고, Dev Container의 `runArgs`와 모든 Compose
파일은 이 네트워크 하나를 사용한다. 컨테이너 안의 `postStartCommand`가
`docker compose up -d`로 PlantUML 선언을 매번 맞추므로 image pin이 바뀌면 해당 작업
폴더의 컨테이너만 교체한다. 전역 컨테이너나 별도 `plantuml` network는 공유하지 않는다.

최초 지적은 현재 작업 트리에서 해결된 것으로 판정한다.

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

### DOC-011 — 일회성 migration 지침이 일반 배포 문서에 섞여 있다

**판정:** 문서 위치와 생명주기 부적절

[`deploy.md`](docs/deploy.md) 129~133행의 `authVersion`과 purchase state machine 최초 배포
절차는 특정 시점의 migration runbook이다. 날짜, 적용 버전, 완료 여부가 없어 시간이
지나면 현재도 적용해야 하는 규칙인지 판단할 수 없다.

**권장 조치:** 버전별 migration 문서, 개별 ADR 또는 changelog로 옮기고 적용 상태와
rollback 조건을 기록한다.

### DOC-012 — PlantUML 다이어그램의 저장소 외부 접근성이 낮다

**판정:** 독자 경험 문제

현재 PlantUML fenced block은 Dev Container와 VS Code extension을 사용하는 독자에게는
유용하다. 반면 GitHub나 일반 Markdown viewer에서는 렌더링된 그림이 아니라 source로
보일 수 있다.

**권장 조치:** GitHub-native Mermaid로 전환하거나 생성한 SVG를 저장하고 CI에서 최신
상태를 검증한다.

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

### DOC-015 — 일부 문서가 현재 분류 규칙과 맞지 않는다

- README는 cross-cutting 문서가 `docs/reference/`에 있다고 설명하지만
  `test-inventory.md`, `nats-jetstream-test-race.md`, `k6-installation-case-study.md`는
  저장소 루트에 있다.
- [`libs.md`](docs/libs.md)는 15줄뿐이라 package manifest와 README에 비해 추가 가치가 작다.
  실제 공개 API와 사용 예제를 추가하거나 README에 합치는 편이 낫다.
- frontend를 배포하지 않는다고 밝힌 deploy 문서에 BFF와 edge 설명이 상당 부분
  들어 있다. frontend 보안 또는 frontend deployment 문서가 더 적절하다.

### 권장 문서 구조

```text
docs/
  README.md
  architecture/
    overview.md
    consistency.md
    data-ownership.md
  operations/
    development.md
    deployment.md
    troubleshooting.md
    migrations/
  testing/
    overview.md
    api-contracts.md
    inventory.md
  reference/
    conventions.md
    environment.md
    adr/
  tutorials/
    showtime-creation.md
  case-studies/
```

문서를 나눌 때는 같은 설명을 복사하지 말고 각 주제의 기준 문서만 상세 내용을 가지게
한다. README와 주변 문서는 한두 문장 요약 후 기준 문서로 연결하는 방식이 적합하다.

## 빠진 문서와 기준

### DOC-016 — 데이터 소유권과 일관성 지도가 없다

collection별 owner, 참조 방향, 삭제 정책, transaction 경계, eventual consistency 경계를
한눈에 보여주는 문서가 필요하다. 현재는 여러 흐름 설명을 읽어야만 전체 모델을
재구성할 수 있다.

### DOC-017 — migration과 versioning 전략이 없다

튜토리얼은 migration을 요구하지만 schema/data migration 도구, 실행 순서, rollback,
mixed-version 호환 정책이 없다. “production base”를 표방한다면 최소한 non-goal인지
향후 도입 대상인지 명시해야 한다.

### DOC-018 — production readiness와 non-goals가 한곳에 정리되어 있지 않다

TLS, secret 관리, backup/restore, HA, observability, frontend 배포, disaster recovery
제약이 여러 문서에 흩어져 있다. 배포 전에 확인할 수 있는 단일 checklist가 필요하다.

### DOC-019 — troubleshooting과 recovery runbook이 없다

MongoDB replica set, Restate 등록, NATS stream, 공유 Docker network, S3 초기화 실패 시
확인 순서와 복구 절차가 없다. 인프라 구성 요소가 많은 만큼 정상 경로 설명만으로는
운영 효율이 낮다.

### DOC-020 — ADR 메타데이터와 생명주기가 없다

현재 단일 `decisions.md`에는 결정 상태, 날짜, owner, superseded-by, 검증 근거가 없다.
변경 가능성이 큰 결정은 개별 ADR로 분리하는 것이 적절하다.

### DOC-021 — 독자별 시작 경로와 glossary가 없다

초보자 대상 튜토리얼이라고 보기에는 CAS, outbox, Restate, durable execution,
projection 등의 용어 밀도가 높다. 다음을 추가하는 편이 좋다.

- 10분 안에 실행하고 확인하는 빠른 시작 경로
- 초급·중급·운영 독자별 읽기 순서
- 프로젝트에서 사용하는 의미를 기준으로 한 glossary
- 튜토리얼별 학습 목표와 완료 시 확인 결과

### DOC-022 — LICENSE 파일이 없다

`package.json`은 MIT를 선언하지만 저장소에 LICENSE 파일이 없다. 재사용자가 실제 적용
조건을 확인할 기준 파일을 추가해야 한다.

### DOC-023 — 문서 freshness를 검증하는 자동화가 제한적이다

현재 링크, formatting, 일부 configuration contract는 잘 검증된다. 하지만 다음과 같은
문서·코드 계약은 자동 검증되지 않는다.

- API batch 제한과 문서의 수치
- replica와 service 개수
- NGINX query logging 여부
- 공개 barrel export
- controller route와 API 문서 inventory
- 튜토리얼 code snippet의 컴파일 가능성
- 테스트 개수처럼 자주 바뀌는 수치

가능하면 코드 상수에서 문서를 생성하거나, 문서의 기대값을 contract test가 확인하도록
한다. 자동화하기 어려운 결정에는 `last verified`, owner, 관련 test 정보를 붙이는 것이
좋다.

## 유지할 가치가 높은 부분

다음 내용은 유지하고 기준 문서를 명확히 하는 것이 좋다.

- 링크와 fragment 상태가 좋고 자동 검사도 갖춰져 있다.
- 기본 테스트의 포함·제외 범위가 실제 script와 일치한다.
- 100% coverage 주장이 현재 실행 결과와 일치한다.
- NATS at-least-once, SSE best-effort, durable status의 차이를 명확히 설명한다.
- Restate `force` 등록의 위험과 versioning 필요성을 제대로 경고한다.
- Dev Container의 Docker socket과 credential mount를 보안 경계로 오해하지 않도록
  경고한다.
- deploy 문서 첫머리에서 production-ready 구성이 아니라고 명시한다.
- 환경 변수 주입 경로와 앱이 `.env`를 직접 읽지 않는다는 설명이 코드와 일치한다.
- “무엇을 했는가”뿐 아니라 “왜 선택했는가”를 기록하려는 방향이 좋다.
- 실제 인프라를 사용하는 테스트 전략은 이 저장소 문서의 핵심 차별점이다.

## 권장 정비 순서

1. `DOC-001`, `DOC-003`, `DOC-004`의 잘못된 규모·로그·데이터 삭제 설명을 바로잡는다.
2. `DOC-002`의 Application·Core·Gateway 규칙과 실제 코드를 하나의 모델로 통일한다.
3. `DOC-013`~`DOC-015`에 따라 `apps.md`를 분할하고 주제별 canonical owner를 지정한다.
4. mock-free, RDB 가치 없음, 운영과 같은 토폴로지 같은 과한 표현을 완화한다.
5. migration, data ownership, production non-goals, troubleshooting 문서를 추가한다.
6. 코드 상수와 문서 수치를 자동 대조하고 튜토리얼 snippet을 compile-test한다.
7. API 계약과 ADR을 생성·검증 가능한 형태로 전환한다.

## 최종 평가

이 문서들은 삭제하거나 대폭 줄일 대상이 아니다. 좋은 기술 내용을 신뢰할 수 있는
구조로 재편해야 하는 상태다.

우선 높은 우선순위 네 항목을 수정하지 않으면 독자가 잘못된 규모, 아키텍처, 로그
개인정보, 데이터 보존 기대를 갖게 된다. 그 뒤 canonical owner를 정하고 중복을 링크로
대체하면 문서의 장기 유지 비용과 drift 가능성을 크게 줄일 수 있다.
