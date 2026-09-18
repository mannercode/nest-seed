# 시드 프로젝트 전체 검토

기준 코드는 main `1510689e`다. 이번 작업은 코드·테스트·실행 설정을 검토하고, 새 가이드를 `docs/new/`에 작성하는 범위다. 실행 코드·의존성·테스트 파일은 변경하지 않았다. 현재 가이드와 과거 가이드 원문도 보존했다.

## 먼저 판단할 것

1. **기존 동작·검증의 오류를 고친다.** 테스트가 5xx를 무시하거나 완료를 sleep으로 추측하는 부분, 정리 실패의 exit 0, 누락된 lint, common 유틸의 잘못된 결과가 우선이다. 새로운 기능·테스트 행렬·보안 장치를 만들 필요가 없다.
2. **실제 중복 상태·불필요한 실행을 줄인다.** 읽지 않는 구매 알림 발행 상태, 상영 완료 뒤 중복 polling, UUID 확인을 위한 실제 S3 200회 업로드가 구체적인 후보다.
3. **계약을 바꾸는 선택은 분리한다.** 영화 assetIds 직접 입력 제거와 상영 접수 lease 제거는 API 동작이 달라진다. 다른 작은 수정에 섞어 자동으로 진행하지 않는다.

모든 발견이 필수 작업은 아니다. 문서에서 실제 검증보다 강하게 주장한 부분은 표현을 바로잡으면 된다. 이름·위치 정리, dependency patch 갱신, 데모의 예외 응답 개선은 현재 계약 결함과 우선순위를 구분한다.

## 미완료 작업

| 우선순위 | 내용                                                      | 근거와 최소 범위                                                                    |
| -------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 먼저     | CI lint 누락과 정리 실패 종료 코드                        | [실행 환경 R1·R2](runtime.md). 기존 검사·실행기만 보완                              |
| 먼저     | 기존 API/SSE/race 테스트의 실패 판정·수명                 | [테스트 T1–T3](tests.md). 현재 assertion·연결·barrier 정리                          |
| 먼저     | 긴 benchmark/race의 5분 token 수명                        | [테스트 T4](tests.md). 실제로 필요한 단계에서 갱신; 액세스 TTL 유지                 |
| 먼저     | common 비교·비밀번호 검증·시간·집계·env·NATS 구독 계약    | [libs의 확인된 문제](libs-and-demos.md). 현재 API 영향과 재사용 계약 문제를 구분    |
| 결정 후  | 영화 assetIds 입력 경로                                   | [API A1](api.md). 업로드 완료와 직접 연결 중 어떤 계약을 제공할지 결정              |
| 단순화   | 구매 알림의 읽지 않는 DB 상태                             | [API A2](api.md). DB 발행 흔적을 유지할 필요가 있는지 판단                          |
| 결정 후  | 상영 접수 lease                                           | [API A3](api.md). 접수 중 중복을 409로 유지할지, 같은 sagaId의 202로 허용할지 선택  |
| 단순화   | API-docs 중복 polling·S3 테스트 비용·미사용 helper 확장점 | [실행 환경 R4·R5](runtime.md), [libs 테스트](libs-and-demos.md). 같은 보장은 유지   |
| 선택     | bootstrap/image 고정·같은 계열 patch 갱신                 | [실행 환경 버전 검토](runtime.md). 전체 도구 교체·TypeScript 일괄 major 갱신은 제외 |
| 선택     | 지역 이름·파일 위치·작은 중복·데모 helper                 | 각 보고서의 선택 항목. 일괄 개명·새 공통화는 하지 않음                              |

## 요청한 여덟 영역과 검토 범위

| 영역                     | 읽은 범위와 결과                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 실행·설정             | env·Dev Container·Compose·Dockerfile·CI·workspace·lint·Vitest·tsconfig 등 [runtime](runtime.md). 범위 106개 중 텍스트 104개 전체; lockfile은 구조/manifest, PNG는 checksum 확인 |
| 2. API 코드·이름         | 테스트를 제외한 `apps/api/src` 254개 전체. DTO·barrel 포함. [api](api.md)                                                                                                       |
| 3. API 테스트            | `src/__tests__`와 흩어진 테스트·fixture를 합한 54개. [tests](tests.md)                                                                                                          |
| 4. 독립 scripts·api-docs | scripts 5개, api-docs 13개. [runtime](runtime.md). 독립 SDK 사용은 유지                                                                                                         |
| 5. 데모                  | console 18개·user-app 14개 전체. [libs-and-demos](libs-and-demos.md)                                                                                                            |
| 6. 공유 패키지           | libs 161개 전체, 테스트 포함. [libs-and-demos](libs-and-demos.md)                                                                                                               |
| 7. 외부 테스트           | tests 25개 전체. [tests](tests.md). API 테스트와 합쳐 텍스트 77개·binary fixture 2개                                                                                            |
| 8. 가이드                | 현행 가이드·한국어/영어 README, 과거 원문 29개·보관 안내·manifest. [문서 판단](docs.md), [새 가이드](../../docs/new/README.md)                                                  |

범위는 서로 겹치므로 행의 숫자를 합쳐 전체 파일 수로 쓰지 않는다. lockfile의 간접 의존성 소스·Docker image digest 공급망·운영 장애 전체를 검토한 것은 아니다. 소스 읽기로 확인한 문제, inline 실행으로 재현한 유틸 오류, 실제 CI 검증을 각 보고서에서 구분한다.

## 유지하는 결정

API·libs 중심, 기존 common 유틸, 독립 scripts의 SDK 사용, 5분 액세스 유효성, 단건/다건 서비스 계약을 유지한다. 같은 이름으로 합치려고 조건 분기를 늘리지 않는다. Restate·JetStream·구매 정합성은 장치별 책임을 검토하며 통째로 삭제하거나 무조건 유지 대상으로 묶지 않는다.

100% coverage·4개 API 복제본·반복 CI·Dev Container reset·free-port는 의도한 선택이다. 테스트 수나 파일 길이만으로 과잉이라 판정하지 않는다. 삭제/생성 경합, 상영 삭제 완성, 실제 PG·메일, 데모의 모든 네트워크 실패, token family·즉시 액세스 회수, 범용 deep-equality/복구/테스트 프레임워크는 새 필수 작업으로 추가하지 않는다.

## 새 가이드의 상태

`docs/new/README.md`는 루트 README의 개정안이고 나머지는 폴더별 안내와 reference다. 현재 코드가 하는 일과 선택 이유를 설명하며, 여기의 미결 개선안이 구현된 것처럼 쓰지 않았다. 기존 문서를 덮어쓰거나 backup 원문을 갱신하지 않았다.

기존 [문서 TODO](../docs-reference-review.md)의 env·MongoDB·검증 범위·테스트 분리·type/interface 표현은 새 가이드에 반영했다. 현행 문서 교체와 영어 README 동기화는 새 가이드를 검토한 뒤 결정할 수 있다.

## 검증

- 기준 코드의 [PR #186 필수 AtoZ](https://github.com/mannercode/nest-seed/actions/runs/35330220547)는 통과했고 main에 머지됐다. CodeQL도 통과했다.
- common 유틸 일부는 Node inline 실행으로 실제 잘못된 결과를 확인했다. 별도 테스트 파일은 추가하지 않았다.
- `pnpm run lint:root`가 통과했다. 문서 링크 237개 중 오류 0개이며 제외 21개는 기존 검사 정책이다. 하위 검토 문서도 별도로 검사해 링크 60개 중 오류 0개를 확인했다.
- 기존 backup 원문과 실행 코드의 diff가 없음을 확인했다. 문서 변경에 새 테스트 파일·의존성·검사 완화는 없다.
