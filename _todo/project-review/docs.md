# 과거 가이드 검토와 현행 문서 반영 판단

검토 범위: `docs/backup`의 과거 원문 29개(이미지 2개 포함), 보관 안내 2개, manifest, `README.en.md` 총 33개. 텍스트는 분할해 전체를 읽었고 그림은 직접 확인했다. 2026-02-27 implementation guide는 앞 날짜 원문과 byte 단위 동일하며 naming guide는 표 공백만 달라, 앞 날짜 전체와 전체 diff를 검토했다. 미검토 파일은 없다. manifest 19개 모두 실제 파일의 Git blob hash와 byte 수가 일치한다. 저장소 원문은 변경하지 않았다.

## 판단

예전 가이드의 가치 있는 부분을 되살리는 일과 당시 구현을 다시 도입하는 일은 다르다. 보존할 핵심은 **경계·선택 이유·한계와 이를 이해할 최소 예시**다. 옛 경로, 메서드, 상태 머신, 테스트 대량 발췌를 다시 붙이면 지금 코드와 충돌한다. 현행 가이드가 이미 보존한 근거는 중복 작성하지 않는다.

새 문서에는 별도 장문 튜토리얼보다 README의 읽기 순서, apps의 실제 계층 예시, reference의 결정·규칙을 둔다. 고유 가치가 있는 예시는 ① 기능 모듈의 controller 의존으로 생기는 cycle, ② 같은 workflow key의 중복과 서로 다른 요청의 충돌 구분, ③ 스키마를 통한 DTO 응답 복원 정도로 제한할 수 있다.

## 남길 가치가 있는 결정과 설명

| 원문 근거                                                                 | 남길 내용                                                                                                                                                                          | 현재 문서에서 둘 곳 / 편집 판단                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `recovered/2026-02-25/docs/ko/guides/problems-with-feature-modules.md`    | Movies controller가 Recommendation을 소비하고 Recommendation이 Movies를 소비하면 service 호출이 단방향이어도 Nest module cycle이 생긴다. Gateway 분리는 이 구조적 원인을 푼다.     | apps의 SoLA 설명에 구체적 짧은 예시 하나. Nest feature module 전체가 나쁘다거나 forwardRef가 항상 틀리다는 일반화는 빼기. |
| `before-reduction/apps.md:99`, `reference/tutorial.md:130`                | 단일 Core로 끝나는 CRUD에는 Application 전달 계층을 만들지 않는다.                                                                                                                 | apps의 계층 배치 원칙. 신기능 작업 순서를 별도 긴 튜토리얼로 강제하지 않기.                                               |
| `recovered/2026-02-25/docs/ko/guides/naming-rules.md:58`                  | Service는 의존 서비스를 호출해 데이터를 모으고, Validator/Recommender는 전달된 데이터로 계산한다.                                                                                  | conventions. 이미 있는 MovieRecommender 실제 예시로 설명 충분.                                                            |
| 같은 문서 `:3`, `:15`, `:97`                                              | 이름은 조회 실패 계약, 업무 목적, 날짜와 시점의 구별을 전달해야 한다. 단순 조건은 객체로 표현한다.                                                                                 | conventions. ById/조건명을 무조건 금지해서 분기·배타적 타입을 늘리지 않는다. 현행 합의의 조건별 함수 예외를 유지.         |
| `recovered/2026-02-25/docs/ko/designs/tickets-purchase.md:246`            | Ticket 이외 상품을 미리 수용하는 구매 일반화는 현재 단계에서 과하다. 실제 요구가 생길 때 확장한다.                                                                                 | decisions 또는 README의 시드 범위에 1~2문장. 원문의 범용 PurchaseItem/Processor 구현 예시는 복제하지 않기.                |
| `before-reduction/reference/tutorial.md:246`                              | 내부 함수별 호출 검증은 작은 구현 변경에도 흔들린다. API 결과·저장 상태 중심 테스트가 시드에 적합하다.                                                                             | conventions의 테스트 이유. 순수 복잡 알고리즘 단위 테스트 예외 유지. top-down만 옳고 bottom-up은 나쁘다는 서사는 생략.    |
| `before-reduction/reference/decisions.md:99`, `reference/tutorial.md:202` | durable step 재실행과 업무 정합성은 별개다. 외부 효과와 journal 기록 사이 간격이 있으므로 재실행 가능한 효과에는 멱등성이 필요하다. 서로 다른 workflow key의 충돌은 DB가 처리한다. | decisions. 현재 Restate 구현에 맞춘 실제 경계 설명.                                                                       |
| `before-reduction/reference/decisions.md:57`, `apps.md:182`               | Core NATS flush는 저장·소비자 처리 확인이 아니다. SSE는 알림이며 DB/상태 API가 결과 기준이다. JetStream도 유한 중복 억제와 ack 간격 때문에 전체 exactly-once가 아니다.             | decisions + apps의 실제 flow. 과거의 SSE 재시도 보장이나 outbox lease 스캐너는 현행에 복원하지 않기.                      |
| `before-reduction/apps.md:607`                                            | env를 module import 시 읽으면 테스트 첫 값이 고정된다. provider 생성 시 주입하면 자원 격리와 static import가 양립한다.                                                             | apps 테스트 설명 또는 libs 설정 경계. Jest resetModules/dynamic import 요령은 폐기.                                       |
| `before-reduction/devcontainer.md:5`, `:13`                               | env-file은 생성 시 주입, 단순 restart는 값 갱신이 아니다. DooD의 bind path는 호스트·컨테이너가 같아야 한다.                                                                        | devcontainer. 독립 environment 문서의 모든 값 목록 대신 코드에서 드러나지 않는 이 제약을 보존.                            |
| `before-reduction/libs.md:9`, `:15`                                       | runtime common / 테스트 소비자 testing / 소스 변환 전 tools를 실행 시점과 의존 방향으로 구분한다.                                                                                  | libs. 파일별 API 나열 대신 경계만.                                                                                        |
| `before-reduction/tests.md:23`, `deploy.md:83`                            | 여러 replicas를 실제로 거쳤는지 관찰해야 분산 경쟁 검증이다. 검증 Compose는 운영 배포 완제품이 아니다.                                                                             | tests. 4 replica·반복 CI·100% coverage는 의도된 범위이므로 단순화 이름으로 제거하지 않기.                                 |
| `before-reduction/reference/environment.md:88`                            | fork 때 저자 링크와 내부 식별자를 무차별 치환하지 않는다. scope는 manifests/imports/aliases/lockfile 함께 변경한다.                                                                | README의 fork 주의점 한 문단. 긴 값별 표는 변동성이 커 그대로 복제하지 않기.                                              |
| `recovered/2026-02-25/docs/glossary.md:7`                                 | 업무 행위(Purchase)와 결과 기록(PurchaseRecord), generic 업로드 확정과 영화 연결의 도메인 행위를 구분한다.                                                                         | conventions 또는 apps의 필요한 위치에서 설명. 옛 이름 교체표·RPC Message 키는 제외.                                       |

위 표의 짧은 경로는 모두 `docs/backup/` 기준이다. 현행 문서에 동일한 의미가 이미 있으면 그 문장을 개선하고 별도 복원 절을 만들지 않는다.

## 현행에 복원하지 않을 내용

| 과거 내용                                                                                                                                  | 이유와 처리                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 구매 completion/reconciliation/publication lease, cron 재조정, 구매 티켓 묶음 blocking lock (`before-reduction/apps.md:190`, decisions §8) | 사용자가 구매도 Restate로 통일하기로 한 이후 폐기된 구조다. 현재 구매 복구를 설명하고 옛 설계를 TODO로 되살리지 않는다.                                                                                     |
| root 계정·ROOT_PASSWORD, access-token authVersion/즉시 폐기 같은 이전 로그인 확장                                                          | 현재 기본 user/admin 로그인 범위 및 5분 access token 계약을 기준으로 한다. 과거 자격증명·역할표는 복사하지 않는다.                                                                                          |
| 강제 터널 이중 승인 플래그/직접 API 무조건 차단 (`before-reduction/reference/environment.md:117`), API docs 광범위 마스킹 (`apps.md:720`)  | 이미 단순화한 정책의 이전 설명이다. 보안 우려를 새 요구사항으로 확장해 재도입하지 않는다. 현재 실행 경로와 공개 범위만 정확히 설명한다.                                                                     |
| `deploy/`, `tests/api-race/`, `tests/api-benchmark/`, `tests/README.md`, test-inventory 및 옛 fixture/helper 경로                          | 현재 `tests/api` 등의 실제 경로와 연결한다. 파일 목록·수치 표는 코드와 중복 관리하지 않는다.                                                                                                                |
| Jest 전용 명명/설치/debug screenshot, 매번 resetModules 후 dynamic import, TypeORM Entity 예시                                             | 현재 Vitest·Mongo driver·Zod DTO·provider 생성 시 설정 주입과 맞지 않는다. 역사 원문에만 보관.                                                                                                              |
| PurchaseItemType.Foods, 상품별 Processor와 장황한 sequence, 실제 PG/이메일 전송, 등급 좌석/복수 상영관/환불 관리                           | 과거 설계 연습 또는 미구현 범위다. 새 기능 계획처럼 쓰지 않는다. 현행 한 구매 한 상영 제약 유지.                                                                                                            |
| 4,000 극장 × 60일 × 8회차 × 500좌석 = 9.6억 tickets (`reference/tutorial.md:185`)                                                          | 설계 연습 규모이고 현재 시드의 처리 능력이 아니다. 앞에서 연습 숫자라고 말해도 이어지는 단일 transaction 설명과 결합하면 지원 규모처럼 읽힌다. 수치 삭제, 요청 제한 안의 실제 복구 예시만 남기기.           |
| 10분 timeslot Set으로 전체 겹침 판정하는 초기 알고리즘 (`recovered/.../archive/showtimes-registration.md:51`)                              | 현재 임의 길이 interval 및 끝 시각 제외 정책과 다르다. 소스 알고리즘과 경계 테스트로 연결하고 옛 pseudo-code 복원하지 않기.                                                                                 |
| 구현·DB 결과를 무조건 별도 테스트로 분리, 조건마다 다층 describe 강제                                                                      | 실패 의미가 같다면 API 응답과 저장 상태를 하나의 behavior 안에서 확인할 수 있다. 테스트 문장 규칙을 테스트 수 증식 이유로 쓰지 않는다. 새 가이드에는 한 행동의 응답·저장 결과를 함께 검증할 수 있음을 명시. |
| exists/existsAny, verify/check/ensure, process/task/job, complete/finish를 영어 단어만으로 고정 정의                                       | `ensure`는 현재 assertion helper이고, 과거 표는 없으면 생성한다고 정의한다. 프로젝트의 실제 공개 계약을 설명하며 사전식 강제 규칙을 확대하지 않는다.                                                        |
| API 카탈로그·curl·테스트 수백 줄 발췌, 패키지 명령 전체 복사                                                                               | 실행 가능한 api-docs와 소스 링크가 기준이다. 문서 예시는 경계 이해에 필요한 몇 줄로 제한한다.                                                                                                               |

## 잘못됐거나 과장된 기술 설명

1. **TypeORM 데코레이터를 쓰면서 Entity가 TypeORM을 참조하지 않는다는 설명은 부정확하다.** `recovered/2026-02-25/docs/ko/guides/implementation.guide.md:123`은 import/데코레이터의 소스 의존을 부정한다. 도메인 계산이 ORM API를 직접 호출하지 않는 것과 라이브러리에 의존하지 않는 것은 다르다. 프레임워크 의존을 허용할지의 선택으로 설명해야 하며, 이를 이유로 현재 시드에 별도 domain/adapter 계층을 더 만들 필요는 없다.
2. **interface만 class가 implements할 수 있는 것은 아니다.** 과거 naming guide `:116`과 현행 conventions의 해당 문장은 팀 스타일로 읽으면 가능하지만 언어 제약으로 읽히기 쉽다. 객체 형태의 type alias도 implements할 수 있고 interface는 선언 병합을 지원한다. type alias도 교차 타입으로 확장할 수 있으므로 'type이면 예상치 못한 확장이 불가능'이라는 표현도 한정해야 한다. [TypeScript classes](https://www.typescriptlang.org/docs/handbook/2/classes.html), [declaration merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html).
3. **Node 22 이상이면 CJS/ESM 호환 문제가 없다는 보장은 틀리다.** 과거 implementation guide `:285`. Node의 require(esm)은 동기 모듈 그래프 조건 등 제한이 있다. 현재 NodeNext/Native ESM의 `.js` 상대 경로·package imports·CJS 도구 확장자 규칙을 쓰면 충분하다. [Node modules](https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require), [Node ESM](https://nodejs.org/api/esm.html).
4. **Kafka가 최소 broker 3 + controller 3으로만 동작한다는 설명은 틀리다.** 과거 design guide `:330`. 공식 문서는 combined 역할을 개발에 사용할 수 있음을 설명한다. 현재 시드에서 NATS가 충분하고 운영 경로를 늘리지 않겠다는 선택 이유로 정리한다. [Kafka KRaft](https://kafka.apache.org/35/operations/kraft/).
5. **KafkaJS 유지보수가 2022년에 종료됐다는 설명은 근거가 없다.** 같은 문서 `:322`. 공식 v2.2.4는 2023-02-27에 배포됐다. 이 사실은 2022 종료 주장을 반박할 뿐 현재 활발한 유지보수를 증명하지 않는다. polling loop 자체가 항상 성능 불리하고 간단한 테스트도 항상 maxWaitTime만큼 기다린다는 일반화도 복원하지 않는다. [KafkaJS releases](https://github.com/tulios/kafkajs/releases).
6. **Redis queue에는 BullMQ가 반드시 필요하다는 설명은 틀린 범위 확장이다.** 축소 전 decisions `:68`. Redis Pub/Sub 자체에 저장·ack가 없다는 한계와 특정 추가 도구가 필수라는 주장은 다르다. 현행 decisions는 'durable 경로는 별도로 설계'로 수정돼 있으므로 유지한다.
7. **barrel cycle이 반드시 build error로 드러난다는 보장은 없다.** 축소 전 apps `:389` 근처. 의존 cycle은 빌드를 통과하고 runtime 초기화 순서 문제로 나타날 수도 있다. 공개 진입점과 부모 barrel을 피하는 이유를 설명하고 자동 검출 보장으로 과장하지 않는다.
8. **임의 ID를 받는 모든 HTTP 경로가 admin 전용이라는 문장은 너무 넓다.** 축소 전 apps `:488` 근처. 영화/상영/티켓 ID로 공개·자기 구매 맥락을 조회하는 경로도 있다. '다른 사용자의 소유 자원을 사용자 ID로 지정하는 관리자 작업'처럼 실제 인가 경계에 한정해야 한다. 새 보안 장치를 도입하라는 뜻이 아니다.
9. **모듈 분리만 하면 MSA 전환이 경계만 끊는 작업이 된다는 설명도 과장이다.** 축소 전 apps `:146` 근처. 방향 제약은 이관 비용을 줄이지만 공유 트랜잭션·통신 실패·서비스 배포 계약은 별도 설계 대상이다. 현재 프로젝트는 다중 replica 모놀리스임을 분명히 한다.
10. **정리 대상이 이미 없으면 무조건 오류여야 한다는 초기 fail-fast 문장도 보편 규칙은 아니다.** 축소 전 conventions `:27`. 소유 범위를 식별하지 못한 실패와, 멱등 cleanup의 이미 지워진 대상은 다르다. 현재 코드가 정한 cleanup 계약을 유지하고 no-op 전부를 fallback으로 비난하지 않는다.

## README.en.md

현재 한국어 README를 기준으로 구조·실행·의도는 대체로 맞는다. 번역본 자체에 별도 설계 결정을 추가하지 않는다. 'production projects의 starting point' 다음에 데모/검증 스택 한계를 둔 점은 적절하다. 새 한국어 README에서 문서 경로나 절 번호를 바꾸면 영어 링크도 함께 갱신해야 한다. 단순히 영어판의 단어 수를 줄이는 작업보다 같은 계약·범위를 유지하는 것이 우선이다.

## 원문 보관과 문서 소유권

`docs/backup`의 회수 이력 안내와 manifest는 원문 출처·무결성을 설명하므로 가이드 보관에 필요하다. 과거 작업 TODO를 이곳에 다시 모으지 않는다. 두 시점 중복 가이드도 원본 보관 목적에서는 삭제할 이유가 없고 새 가이드에서 중복 설명만 합친다. 옛 Kafka Compose와 실행 스크립트는 현행 지원 경로가 아니며 보관본으로만 남긴다. 불완전한 스크립트를 현재 검증에 넣거나 고쳐서 실행할 이유가 없다.
