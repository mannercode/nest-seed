# API 소스 검토

최초 검토는 `1510689e`의 `apps/api/src` 실행 소스 254개를 대상으로 했다. DTO·barrel·설정·모듈·모델까지 포함하고, 테스트 54개 파일은 [테스트 검토](tests.md)가 다룬다. 아래 근거는 당시 상태이며, 후속 사용자 결정과 반영 상태를 항목별로 표시한다.

## 판단

SoLA 경계와 common 연동 분리는 대체로 맞다. 새로운 계층·Repository interface·범용 workflow 프레임워크를 도입할 이유는 찾지 못했다. authVersion이나 즉시 액세스 회수 장치는 없고, 기존의 5분 액세스·리프레시 회전이라는 기본 로그인 구조를 유지한다.

단순화 가치가 큰 후보는 구매 알림의 읽지 않는 DB 상태와 상영 접수 lease다. 두 번째는 API 계약까지 바뀌므로 첫 번째와 같은 성격의 정리로 묶어서는 안 된다. 파일 업로드는 부정확한 입력 경로를 먼저 정해야 한다. 함수 이름을 일괄 바꿔 해결할 문제는 아니다.

## 계약 결정이 필요한 문제

### A1. 영화 assetIds 직접 입력이 업로드 완료 경로를 우회한다

상태: 완료. 사용자 결정에 따라 create/update의 assetIds 입력을 제거했다. 업로드·finalize로만 연결하며 직접 입력은 400이다. 기존 이미지 조회 fixture·race·API 문서도 같은 경로를 사용한다.

[UpsertMovieSchema](../../apps/api/src/services/core/movies/dtos/upsert-movie.dto.ts)는 임의 assetIds를 받고 [MoviesRepository](../../apps/api/src/services/core/movies/movies.repository.ts)는 그대로 저장한다. [finalizeUpload](../../apps/api/src/services/core/movies/movies.service.ts)는 그 ID가 영화 배열에 있으면 pending을 제거하고 바로 성공한다. 해당 asset의 업로드·owner를 확인하고 부여하는 아래 경로를 지나지 않는다.

따라서 자기 pending asset을 PATCH의 assetIds에 먼저 넣으면 정상 완료 응답을 받아도 owner가 비어 있을 수 있다. 다른 영화의 asset도 연결할 수 있는 반면 삭제는 실제 owner를 다시 확인한다. 입력 경로와 삭제·완료의 판단 기준이 다르다. 코드 경로로 확인했으며 새 API 호출로 재현한 결과는 아니다.

**추천은 create/update의 assetIds 직접 입력을 없애고 기존 업로드·finalize 경로만 남기는 것**이다. 현재 데모·API 문서에 비어 있지 않은 assetIds를 직접 넣는 사용은 없고, 영화 테스트 fixture 두 곳에서 사용한다. 배열 순서가 이미지 표시 순서를 정하므로 정렬·재연결을 위한 입력으로 남길 의도인지 먼저 결정해야 한다. 허용 입력 제거는 계약 변경이다. 새로운 이미지 정렬 API나 권한 프레임워크를 선제적으로 만들지 않는다.

## 단순화 후보

### A2. 구매 알림의 DB 발행 상태는 실행에 사용하지 않는다

상태: 완료. 사용자 결정에 따라 필드·mark 메서드·DB 기록 step을 제거했다. Restate의 발행 재시도와 JetStream 중복 억제를 유지하며, 발행 전 장애와 발행 후 응답 유실에서도 구매 응답이 유지됨을 검증한다. 기존 DB 문서의 필드를 일괄 삭제하는 데이터 마이그레이션은 포함하지 않는다. 진행 중인 이전 journal은 [기존 revision에서 끝내는 조건](../../docs/reference/decisions.md#배포-revision)을 따른다.

[purchaseEventStatus](../../apps/api/src/services/core/purchase-records/models/purchase-record.ts)는 production에서 초기값과 발행 후 쓰기만 있고 이를 읽어 재시도를 결정하는 코드는 없다. [알림 workflow](../../apps/api/src/services/application/purchase/worker/event-workflow.ts)는 Restate의 발행 step을 완료한 뒤 별도 step에서 `markEventPublished`를 호출한다. 복구의 주체는 이 DB 필드가 아니라 Restate다.

필드·mark 메서드·두 번째 step을 제거하는 것이 시드에 더 작다. JetStream 발행 재시도, 판매·보상, 최초 응답 재생에는 이 표시가 필요하지 않다. 다만 DB에서 보는 발행 흔적과 이 갱신에 따른 updatedAt 변화는 사라지므로 “동작이 전혀 바뀌지 않는다”고 표현하면 안 된다. 기존 테스트·문서와 보존된 workflow journal의 코드 변경 조건도 함께 처리해야 한다. 대체 관측 장치는 추가하지 않는다.

### A3. 상영 접수 lease는 접수 중 409 계약의 비용이다

상태: 유지로 결정. 사용자가 기존 접수 중 409 응답과 lease 유지를 선택했다. 현재 구현과 검증을 유지하며 제거 작업으로 남기지 않는다.

[SubmissionRepository](../../apps/api/src/services/application/showtime-creation/internal/showtime-creation-submission.repository.ts)의 principal+key, inputHash, sagaId, accepted 기록은 서로 다른 책임이 있다. 키 재사용 거절, 작업 ID 고정, 인증 주체별 상태 조회를 담당하므로 Restate key 하나로 모두 대체할 수 없다.

claimId·claimUntil·5분 lease는 같은 요청의 제출 담당자를 하나로 정하고 접수 중 중복을 409로 돌린다. 제출 서버가 종료되면 다음 요청이 lease 만료까지 기다리지만 중복 실행 자체는 같은 sagaId와 DB operation으로 막는다.

같은 본문의 동시 접수도 동일 sagaId로 제출한 뒤 202를 받게 허용한다면 claim·만료·release 분기를 줄일 수 있다. **현재 접수 중 409를 유지한다면 lease도 설명 가능한 구현이다.** 단순화하려고 lease만 제거하거나 기간을 근거 없이 줄이지 않는다. accepted 기록은 유지해 과거 키 재요청의 불필요한 재제출도 막아야 한다. API 계약 선택 뒤에 구현할 후보다.

### A4. 작은 코드 정리

상태: 반영 완료. 단순 DTO 매핑 6곳은 단건 변환을 다건에서 재사용하고 추천 정렬의 중복 분기를 제거했다. Movies의 일괄 asset 조회는 유지한다. 상영 응답 조합은 `toBookingShowtimes`, 상영 workflow client 파일은 클래스명에 맞췄다. 나머지 이름은 현재 의미가 명확해 개명하지 않으며 도메인 계산·역할별 인증 위임의 소유 경계도 유지한다.

- 여러 서비스의 `toDto`가 배열 하나를 만들어 `toDtos`를 호출한 뒤 `ensure`한다. 단순 `mapDocToDto`인 Users·Theaters·Payments·WatchRecords 등은 단건 변환을 직접 쓰고 다건이 이를 호출하면 읽기 쉽다. Movies는 asset URL을 묶어서 조회하므로 같은 방식으로 바꾸면 다건 조회 최적화를 잃을 수 있다. 일괄 변환하지 않는다.
- [MovieRecommender](../../apps/api/src/services/application/recommendation/domain/movie-recommender.ts)의 관람 이력 없는 분기에서는 genreScore가 모두 0이다. 같은 `genreScore, releaseDate` 정렬로 결과가 같아 분기 하나를 줄일 수 있다. 별도 전략 클래스나 추천 옵션을 만들지 않는다.
- [Booking utils](../../apps/api/src/services/application/booking/booking.utils.ts)의 상영 응답 조합, [Showtime validator](../../apps/api/src/services/application/showtime-creation/internal/showtime-bulk-validator.service.ts)의 실제 시간 충돌 계산은 앱 도메인 책임이다. 일반 유틸처럼 common으로 옮기지 않는다.
- Users/Admins의 유사한 인증 위임을 하나로 합치려면 역할·repository·payload를 주입하는 추상화가 필요하다. 현재 두 작은 구현을 유지하는 편이 읽기 쉽다. 같은 이유로 모든 `toDto`, repository create/update를 범용 service로 묶지 않는다.

## 이름 검토 결과

이름이 길거나 매개변수가 포함됐다는 이유로 바꾸지 않는다. 아래는 의미상 개선 가능한 대상이고 모두 즉시 변경할 목록은 아니다.

| 현재 이름                                                                    | 판단·가능한 대안                                                                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `findForAuthentication`                                                      | 비밀번호를 포함하는 조회 목적을 드러내므로 유지                                                                  |
| `existsByMovieIds` / `existsByTheaterIds`                                    | 각각 명확한 조회다. 선택 인자 분기를 도입해 합치지 않음                                                          |
| `findByIdempotencyKey` / `findByPurchaseRecordId`                            | unique key의 의미를 드러내므로 유지 가능                                                                         |
| `generateShowtimesForBooking`                                                | 이미 있는 상영에 판매 정보를 붙인다. `toBookingShowtimes`가 생성 작업과 덜 혼동됨                                |
| `searchRecommendedMovies`                                                    | 조회 후 계산한 추천을 반환한다. `recommendMovies`는 선택적 개선이며 현재 이름도 소비자를 오도할 정도는 아님      |
| `revokeAllForUser`                                                           | 실제 대상은 refresh session이다. common까지 정리할 때 `revokeAllRefreshSessions`처럼 액세스 회수와 구분하면 유익 |
| `PurchaseService.processPurchase`                                            | `purchase`도 가능하지만 현재 의미는 명확함. 규칙 때문에 개명할 이익은 작음                                       |
| `ShowtimeCreationWorkflowClient`가 있는 `restate-workflow-client.service.ts` | 클래스의 업무 역할에 맞춘 파일명이 찾기 쉬움. 관련 수정 때 맞출 정도                                             |
| `worker/workflow.ts`, `internal/types.ts`                                    | 작은 모듈 안에서는 경로가 범위를 제공함. 모든 파일에 긴 도메인 접두사를 복제할 필요 없음                         |
| `CreatePurchaseRecordDto` 등 내부 class DTO                                  | JSON 경계를 통과하지 않는 인자에는 별도 Zod 스키마를 강제할 필요 없음                                            |
| `ticketItems = createDto.purchaseItems`, `ids = ticketIds`                   | 새 의미를 주지 않는 지역 별칭. 주변 수정 때 제거할 수 있음                                                       |
| `id`, `dto`, `doc`, 반복문의 `i`                                             | 짧은 범위에서 대상이 분명하면 유지. 이름 글자 수가 품질 기준이 아님                                              |

일반적인 Service·Repository·DTO·모델 이름은 역할과 맞는다. `getMany`·`deleteMany`의 기존 단건/다건 계약은 사용자 결정대로 유지한다. Repository 조회의 `null`, get의 예외, 검색의 부분 결과는 이름보다 먼저 지켜야 하는 계약이다.

## 유지할 복잡성과 확대하지 않을 범위

- 구매 claim의 owner 확인·해제, 이중 판매를 막는 DB 전이, 결제 멱등성·보상은 예제가 실제로 약속한 정합성이다. 줄이려면 약속을 먼저 바꿔야 하며 catch로 실패를 성공 처리해서는 안 된다.
- 상영 생성의 transaction 전 극장 갱신은 경쟁을 실제 쓰기 충돌로 만드는 장치다. version 값을 비교하는 일반 CAS와 정확히 같은 구현이라고 설명하지 않고, guard 갱신·WriteConflict·새 snapshot 재시도의 의미를 문서에 적는다.
- 상영·티켓 수와 transaction 시간 상한은 한 번에 처리할 수 있는 단위를 제한한다. 이를 없애거나 대규모 배치 scheduler로 확대하지 않는다.
- 영화 publish와 필수 필드 검증은 서비스가, 검증한 version만 갱신하는 조건은 repository가 맡는 현재 분리를 유지한다.
- S3 삭제 실패 뒤 DB 행 유지, 같은 소유자의 finalize 재시도, 만료된 무소유 업로드 정리는 기존 파일 흐름의 의미가 있다. 임의의 다른 owner까지 지우는 단순화는 하지 않는다.
- 삭제·생성 경합, 상영 삭제 API 완성, 장기 상태 조회 제품, 실제 PG·메일 발송, 모든 무효 입력 조합은 이번 감사에서 새 필수 기능으로 만들지 않는다.
- 직접 SDK 사용은 common 경유이며 Nest·Zod·Express·RxJS·Node 기본 API까지 감싸지 않는다. 독립 scripts는 다른 경계다.

## 확인의 한계

이 문서는 소스·호출부·기존 테스트와 문서를 읽은 검토다. 새 테스트 파일이나 운영 코드는 만들지 않았다. 기준 커밋의 필수 AtoZ CI는 통과했지만, 그것이 이 검토의 후보를 반증하거나 모든 동시성·장애를 검증한 것은 아니다.
