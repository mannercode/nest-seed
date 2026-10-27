# 기존 구현의 축소 후보

기준은 `fb1ef0cd`이며 검토 시작 시 미커밋·미추적 변경은 없었다. 아래 항목은 코드와 호출 관계로 확인한 범위 판단이다. 기능 삭제를 진행 대상으로 확정하지 않았으며, 시드 완료 조건에서 제외한다.

[현재 시드](../apps/README.md#시드의-범위)는 CRUD와 분산 실행을 함께 보여 준다. 사용처가 연결되지 않은 기능은 축소를 우선 검토하되, 분산 실행 예제를 유지하면서 그 예제에 필요한 정합성 처리만 제거하지 않는다.

## S1. 관람 이력에 따른 개인화 추천 — 축소 우선 검토

[추천 서비스](../apps/api/src/services/application/recommendation/recommendation.service.ts)는 로그인한 사용자의 최근 관람 이력을 읽고, [추천 계산](../apps/api/src/services/application/recommendation/domain/movie-recommender.ts)은 이미 본 영화를 제외하고 장르 선호도로 정렬한다. 그러나 [관람 이력 생성](../apps/api/src/services/core/watch-records/watch-records.service.ts)의 호출자는 [테스트 준비 코드](../apps/api/src/__tests__/helpers/utils/watch-records.utils.ts)와 해당 서비스 테스트뿐이다. 현재 API·구매 workflow·데모에는 관람 이력을 쌓는 경로가 없다.

빈 DB에서 제공된 앱 흐름만 실행하면 개인화에 필요한 이력이 생기지 않는다. 그 상태에서도 로그인한 홈 조회는 관람 이력을 조회하고, 별도 collection·모듈·DTO·장르 계산을 유지해야 한다. 순수 계산 예제로서의 가치는 있지만, 실제 연결 흐름을 보여 주는 시드에서는 유지 근거가 약하다.

추천안은 구매 가능한 공개 영화의 개봉일 정렬을 남기고 개인화와 관람 이력 모듈을 줄이는 것이다. 관람 이력 수집 기능을 새로 구현하는 방향으로 범위를 늘리지 않는다. 변경한다면 홈 응답·공개 영화 조건·구매 마감 조건을 기존 API 테스트와 데모에서 확인한다. 개인화 예제를 계속 제공할지는 결정이 필요하다.

## S2. 로그만 남기는 구매 완료 알림 — 기본 예제 포함 여부 보류

[구매 workflow](../apps/api/src/services/application/purchase/worker/workflow.ts)는 완료 후 [별도 발행 workflow](../apps/api/src/services/application/purchase/worker/event-workflow.ts)를 접수한다. 이 작업은 [JetStream](../apps/api/src/services/application/purchase/purchase-event.service.ts)에 저장하고, [알림 소비자](../apps/api/src/services/application/purchase/internal/purchase-notification.service.ts)는 발송할 내용을 로그로 남긴 뒤 ack한다. 실제 메일·문자·앱 알림 발송은 없다. [PurchaseModule](../apps/api/src/services/application/purchase/purchase.module.ts)이 소비자와 발행 workflow를 항상 등록한다.

현재 사용자 기능에 비해 발행 접수·보존 정책·재전달·소비자 종료를 읽고 관리하는 부담이 크다. 다만 [메시지 보장 예제](../apps/README.md#메시지가-보장하는-것)로서는 목적이 명확하다. Restate는 발행 작업을 재개하고 JetStream은 소비자가 중단된 동안 메시지를 보존하므로 두 구성 요소가 같은 역할을 중복 구현한 것은 아니다.

일반 앱의 출발점을 우선한다면 기본 구매 흐름에서 이 알림 예제를 제외하는 안을 추천한다. JetStream의 발행·소비 예제를 앱 안에 유지할지는 별도로 결정한다. 제거할 경우 구매 완료·보상 계약은 유지하고 알림 보존 계약과 대응 테스트·문서를 함께 조정해야 한다. 현재 계약을 그대로 둔 채 발행을 기다리지 않거나 실패를 무시하는 변경은 축소안에 포함하지 않는다.

## S3. 상영 생성의 비동기 접수·상태·SSE — 예제 목표 결정 전 보류

실제 [검증·상영·티켓 생성](../apps/api/src/services/application/showtime-creation/internal/showtime-creation-persistence.service.ts)은 한 MongoDB transaction이다. 그 바깥에 [접수 기록과 lease](../apps/api/src/services/application/showtime-creation/internal/showtime-creation-submission.repository.ts), [Restate 제출과 상태 조회](../apps/api/src/services/application/showtime-creation/showtime-creation.service.ts), [workflow](../apps/api/src/services/application/showtime-creation/worker/workflow.ts), [NATS 진행 알림](../apps/api/src/services/application/showtime-creation/showtime-creation-event.service.ts), [SSE 경로](../apps/api/src/services/gateway/showtime-creation.http-controller.ts)가 있다. 현재 두 데모 화면에는 이 API를 호출하는 기능이 없다.

상영을 등록하는 기능만 필요하다면 동기 transaction으로 줄일 여지가 있다. 그러나 현재 [상영 생성 계약](../apps/README.md#상영-생성과-알림)은 중단 후 재개·202 접수·상태 조회·복제본 간 진행 알림을 보여 준다. 구매 workflow와도 학습 목적이 완전히 같지는 않으므로 지금 바로 불필요하다고 판정하지 않는다.

분산 실행 예제를 구매에 집중할지 먼저 결정한다. 동기화한다면 HTTP 계약·호출자·재시도 의미를 함께 바꾸고, 시간 중복 방지와 상영·티켓 생성의 원자성은 기존 경합·부분 실패 테스트로 유지해야 한다. 비동기 기능을 유지하면서 접수 기록이나 멱등성 보장만 제거하지 않는다.

## S4. 항상 시작하는 분산 인프라 — 기본 실행 범위 결정 전 보류

[기본 Compose](../infra/compose.yml)는 MongoDB 3개, Redis 3개, S3·NATS·Restate 각 1개를 시작한다. 초기화용 컨테이너를 제외해도 인프라 서버 9개다. [Dev Container](../.devcontainer/devcontainer.json)는 시작 시 이 구성을 준비하며, [앱 모듈](../apps/api/src/app.module.ts)과 [연결 설정](../apps/api/src/modules/app-config.module.ts)은 분산 예제를 항상 포함한다. [health 검사](../apps/api/src/modules/health/health.service.ts)도 NATS·Restate를 필수 기능으로 취급한다.

인증·CRUD만 가져다 쓰려는 경우 초기 실행 부담이 크다. 반면 [인프라 가이드](../infra/README.md#1-개발-환경에서도-분산-구성을-사용하는-이유)의 실제 복제·hash slot·메시지·journal 검증 목적에는 근거가 있다. 이번 검토에서는 실제 메모리 사용량과 시작 시간을 측정하지 않았다.

가벼운 기본 앱을 별도로 제공할지 결정하기 전에는 서버 수나 검증 구성을 줄이지 않는다. 단순히 Compose profile을 추가해도 앱의 필수 연결은 남으므로 앱 조립·설정·실행 명령을 함께 검토해야 한다. 구성 분리가 필요하다면 현재 분산 환경과 라이브러리 검증을 유지할 수 있는 범위를 먼저 정한다.

## 검토 범위와 남은 판단

앱·API·인프라 가이드, API 모듈 조립과 연결 설정·health, 추천·홈 조합·관람 이력, 구매 workflow와 알림, 상영 생성의 접수·저장·workflow·HTTP 경로, 기본 Compose와 Dev Container·루트 실행 명령을 중심으로 검토했다. 추천 테스트와 데이터 준비 코드를 읽고, 두 데모의 호출 경로와 관람 이력 생성 호출자를 검색했다. 전체 저장소 리뷰는 아니며, 각 테스트와 프런트엔드 파일 전체·CI·실행 도구·라이브러리 내부 전체는 이번 판단의 검토 범위에 포함하지 않았다.

최근 인증 수정은 기존 비밀번호 변경·탈퇴·로그아웃·갱신 계약을 지키는 데 필요한 처리다. 시드라는 이유로 이 보장을 제거할 근거는 확인하지 못했다. `libs/`는 [공개 계약 기준](../AGENTS.md#영역별-판단-기준)을 적용하므로 앱의 축소 여부만으로 공개 기능을 삭제하지 않는다.

동작 변경이나 장애 재현은 수행하지 않았다. 남은 결정은 개인화 예제의 유지 여부, 구매 알림·상영 생성이 보여 줄 분산 실행 범위, 별도 기본 실행 구성의 필요성이다. 결정 전까지 네 항목 모두 보류한다.
