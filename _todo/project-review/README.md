# 시드 프로젝트 전체 검토

최초 검토의 기준 코드는 main `1510689e`다. 하위 보고서의 파일 수·행 번호·검증 기록은 당시 상태이며, 현재 반영 상태와 선택적 후속 작업은 아래 목록을 따른다. 가이드 개정안은 루트 README와 `docs/`에 반영됐다.

## 먼저 판단할 것

1. **기존 동작·검증의 오류를 고친다.** 테스트가 5xx를 무시하거나 완료를 sleep으로 추측하는 부분, 정리 실패의 exit 0, 누락된 lint, common 유틸의 잘못된 결과가 우선이다. 새로운 기능·테스트 행렬·보안 장치를 만들 필요가 없다.
2. **실제 중복 상태·불필요한 실행을 줄인다.** 읽지 않는 구매 알림 발행 상태, 상영 완료 뒤 중복 polling, UUID 확인을 위한 실제 S3 200회 업로드가 구체적인 후보다.
3. **계약을 바꾸는 선택은 사용자 결정에 따른다.** 영화 assetIds 직접 입력과 구매 알림 DB 상태는 제거하고, 상영 접수 중 409 응답과 lease는 유지하기로 결정했다.

모든 발견이 필수 작업은 아니다. 문서에서 실제 검증보다 강하게 주장한 부분은 표현을 바로잡으면 된다. 이름·위치 정리, dependency patch 갱신, 데모의 예외 응답 개선은 현재 계약 결함과 우선순위를 구분한다.

## 선택적 후속 작업

확인된 오류와 API A1–A3의 결정·반영은 완료했다. 아래는 미해결 계약이 아닌 선택적 단순화·정리 후보이며 이번 변경에는 포함하지 않는다.

| 우선순위 | 내용                                                      | 근거와 최소 범위                                                                    |
| -------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 단순화   | API-docs 중복 polling·S3 테스트 비용·미사용 helper 확장점 | [실행 환경 R4·R5](runtime.md), [libs 테스트](libs-and-demos.md). 같은 보장은 유지   |
| 선택     | bootstrap/image 고정·같은 계열 patch 갱신                 | [실행 환경 버전 검토](runtime.md). 전체 도구 교체·TypeScript 일괄 major 갱신은 제외 |
| 선택     | 지역 이름·파일 위치·작은 중복·데모 helper                 | 각 보고서의 선택 항목. 일괄 개명·새 공통화는 하지 않음                              |

## 최초 검토 범위

| 영역                     | 읽은 범위와 결과                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 실행·설정             | env·Dev Container·Compose·Dockerfile·CI·workspace·lint·Vitest·tsconfig 등 [runtime](runtime.md). 범위 106개 중 텍스트 104개 전체; lockfile은 구조/manifest, PNG는 checksum 확인 |
| 2. API 코드·이름         | 테스트를 제외한 `apps/api/src` 254개 전체. DTO·barrel 포함. [api](api.md)                                                                                                       |
| 3. API 테스트            | `src/__tests__`와 흩어진 테스트·fixture를 합한 54개. [tests](tests.md)                                                                                                          |
| 4. 독립 scripts·api-docs | scripts 5개, api-docs 13개. [runtime](runtime.md). 독립 SDK 사용은 유지                                                                                                         |
| 5. 데모                  | console 18개·user-app 14개 전체. [libs-and-demos](libs-and-demos.md)                                                                                                            |
| 6. 공유 패키지           | libs 161개 전체, 테스트 포함. [libs-and-demos](libs-and-demos.md)                                                                                                               |
| 7. 외부 테스트           | tests 25개 전체. [tests](tests.md). API 테스트와 합쳐 텍스트 77개·binary fixture 2개                                                                                            |
| 8. 가이드                | 당시 가이드·한국어/영어 README, 과거 원문 29개·보관 안내·manifest. [문서 판단](docs.md), [현행 가이드](../../README.md)                                                         |

범위는 서로 겹치므로 행의 숫자를 합쳐 전체 파일 수로 쓰지 않는다. lockfile의 간접 의존성 소스·Docker image digest 공급망·운영 장애 전체를 검토한 것은 아니다. 소스 읽기로 확인한 문제, inline 실행으로 재현한 유틸 오류, 실제 CI 검증을 각 보고서에서 구분한다.

## 유지하는 결정

API·libs 중심, 기존 common 유틸, 독립 scripts의 SDK 사용, 5분 액세스 유효성, 단건/다건 서비스 계약을 유지한다. 같은 이름으로 합치려고 조건 분기를 늘리지 않는다. Restate·JetStream·구매 정합성은 장치별 책임을 검토하며 통째로 삭제하거나 무조건 유지 대상으로 묶지 않는다.

100% coverage·4개 API 복제본·반복 CI·Dev Container reset·free-port는 의도한 선택이다. 테스트 수나 파일 길이만으로 과잉이라 판정하지 않는다. 삭제/생성 경합, 상영 삭제 완성, 실제 PG·메일, 데모의 모든 네트워크 실패, token family·즉시 액세스 회수, 범용 deep-equality/복구/테스트 프레임워크는 새 필수 작업으로 추가하지 않는다.

## 완료된 문서 반영

가이드 개정안은 루트 README와 폴더별 `docs/`, `docs/reference/`로 반영됐다. `docs/new/`와 `_todo/docsold/`는 현재 경로가 아니다. 과거 원문이 필요하면 최초 검토 커밋의 Git 이력을 확인한다.

[문서 검토 6개 항목](../docs-reference-review.md)은 완료됐다. SoLA의 계층 구분·컨트롤러 분리와 서비스 단수·복수·DTO/Schema 네이밍도 현행 가이드에 반영됐다.

## 완료된 검증 보완

- [R1·R2](runtime.md): 누락된 설정·개발 도구의 lint를 연결하고, 실행기 정리 실패가 성공으로 끝나지 않도록 종료 코드를 보존한다.
- [T1–T3](tests.md): SSE 준비 후 요청, 성공·생성 개수·동시 finalize 응답 단언, 실패 시 stream·worker·barrier 정리를 반영했다. cron 정리는 작업 완료를 직접 기다린다.
- [T4](tests.md): 장시간 race의 반복 전 인증 갱신과 benchmark의 만료 전 갱신을 반영했다. 액세스 TTL 5분과 업무 응답의 실패 판정은 유지한다.
- [common의 확인된 문제 6개](libs-and-demos.md): 중첩 Temporal 비교, 음수 시간 왕복 변환, 없는 해시의 인증 실패, 잘못된 env 거절, 문자열 키 집계, 동시 NATS 구독 준비를 수정했다.
- [A1–A3](api.md): 영화 이미지는 업로드·finalize로만 연결하고, 구매 알림의 발행 복구는 Restate가 맡는다. 상영 접수 중 409와 lease는 유지한다. 구매 알림의 기존 DB 필드를 일괄 삭제하지 않으며, 진행 중인 이전 journal은 기존 revision에서 완료해야 한다.
- README의 삭제된 보관 문서 링크 두 개가 [AtoZ 실패](https://github.com/mannercode/nest-seed/actions/runs/35762228653)의 원인이었다. 링크를 수정한 뒤 현행 가이드와 `_todo` 링크 검사가 모두 통과했다.

인프라 초기화를 제외한 AtoZ 본 검증과 마지막 Temporal 보완 후 API·common 재검증을 로컬에서 통과했다. 최종 API 404개·common 547개는 커버리지 100%를 유지했고, testing 29개·브라우저 E2E 18개·API 문서 76개도 통과했다. GitHub Actions에서 수정본을 다시 실행한 결과는 아니다.

benchmark는 `DURATION_MS=35000`으로 7개 부하 조건을 5분 27초 동안 실행해 모두 오류율 0을 확인했다. 기존 액세스 TTL 5분을 넘긴 실행이며, 인증 갱신 실패가 전체 실행을 중단하고 업무 401은 재시도하지 않는 경로도 실제 스크립트를 사용한 격리 검증으로 확인했다.

변경한 race 5개(`ticket-holding-race`, `purchase-overlap-race`, `purchase-double-spend`, `showtime-overlap-race`, `sse-fanout-race`)는 4개 복제본에서 각각 `INNER_ITERATIONS=2`로 통과했다. 그룹·동시 요청 수는 기본값을 유지했으며 SSE는 회차마다 100개 client × 10개 saga의 이벤트 1,000개를 전달했다. 기본 반복 횟수와 전체 race 묶음을 실행한 결과는 아니다.

이전 검증에서 `replica-chaos`는 기본 시간·부하·오류율 기준으로 통과했고, 복구 후 복제본 4개 응답과 전체 오류율 0.056%를 관측했다.

## 최초 검토 당시의 검증

- 기준 코드의 [PR #186 필수 AtoZ](https://github.com/mannercode/nest-seed/actions/runs/35330220547)는 통과했고 main에 머지됐다. CodeQL도 통과했다.
- common 유틸 일부는 Node inline 실행으로 실제 잘못된 결과를 확인했다. 별도 테스트 파일은 추가하지 않았다.
- `pnpm run lint:root`가 통과했다. 문서 링크 237개 중 오류 0개이며 제외 21개는 기존 검사 정책이다. 하위 검토 문서도 별도로 검사해 링크 60개 중 오류 0개를 확인했다.
- 기존 backup 원문과 실행 코드의 diff가 없음을 확인했다. 문서 변경에 새 테스트 파일·의존성·검사 완화는 없다.
