# 할 일

`cef0a18c`의 코드와 지금까지의 사용자 결정을 기준으로 다시 확인했다. `apps/api`와 `libs/`를 중심으로 시드에 필요한 작업만 남긴다. 검토 원문과 사용자 주석은 [과거 자료](../docs/backup/README.md)에 보존하며, 원문의 “미해결”·“제안” 표기는 현재 작업 지시가 아니다.

## 남은 작업

- [ ] **CI에서 빠진 스크립트의 lint를 연결한다.** [루트](../package.json)의 `lint:root`는 형식·링크·shell만 검사한다. `vitest.config.base.mjs`, `tools/dev-tools/free-port.js`, `libs/common/vitest.global.cjs`·`vitest.teardown.cjs`는 workspace의 Oxlint 대상에서도 빠져 있다. 기존 Oxlint 설정과 `lint`·`atoz` 진입점에 포함하면 된다. 새 도구·규칙·테스트는 필요 없다. 이전 전체 검토 15번은 여전히 유효하다.
- [ ] **[문서의 남은 불일치와 표현](docs-reference-review.md)을 정리한다.** env 주입 방식, MongoDB 설명, 실제 테스트가 확인하는 범위와 개발 규칙의 표현을 맞춘다. 코드 변경을 마친 뒤 진행할 문서 작업이다.

## 완료된 항목

번호는 [이전 전체 검토](../docs/backup/reviews/seed-project-review.md)의 제안 번호다. 현재 구현과 기존 테스트 내용을 대조해 상태를 구분했다.

| 항목                                                                 | 현재 상태                                                                                                                              |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [단순화 계획](../docs/backup/reviews/runtime-simplification-plan.md) | 빈 조회 조건, 런타임의 테스트 분기, 인증 확장 지점, 중복 단위테스트, 한 구매·한 상영, 구매의 Restate 복구, 명시적 DTO 변환을 반영했다. |
| 2·3                                                                  | NATS 진행 알림 실패가 상영 생성을 막지 않는다. 같은 소유자의 업로드 완료 재시도는 만료 후에도 파일을 보존한다.                         |
| 4a·4b·4c                                                             | 요청의 부적절한 `null`·강제 형변환을 제거했다. 공개 영화 수정 규칙은 서비스에서 검사하고 HTTP 예외로 반환한다.                         |
| 6                                                                    | 공개 화면의 상영·추천 후보에서 미공개 영화를 제외한다. 내부 관람 이력 조회는 유지한다.                                                 |
| 8·9·10                                                               | race의 잘못된 성공 판정, MongoDB readiness의 쓰기 실패 누락, S3 테스트 정리의 개별 삭제 실패 누락을 고쳤다.                            |
| 11                                                                   | shell의 env `source`를 제거하고 Dev Container 환경 상속·Compose `format: raw`로 통일했다. 설명 갱신만 남았다.                          |
| 12                                                                   | 인증 간소화를 보류하자는 옛 제안은 현재와 다르다. `authVersion` 등을 제거했고 액세스 토큰은 5분 만료까지 유효하다.                     |
| 추가 오류 점검                                                       | Redis `multi().exec()`의 개별 명령 실패를 검사한다. API의 일반 오류와 5xx 로그 처리도 정리했다.                                        |
| 18·19·20                                                             | README의 접속 안내, 근거 없는 `clean` 보장 제거, TODO의 상태 구분을 반영했다.                                                          |

## 유지하거나 범위에서 제외한 항목

- **삭제 정책:** 등록된 상영이 있으면 영화·극장 삭제를 거부한다. 자동 연쇄 삭제, 삭제·생성 동시성 제어, 상영 삭제 API 추가는 이번 시드 작업에 넣지 않는다. [옛 경합 분석](../docs/backup/reviews/catalog-deletion-showtime-creation-race.md)은 미완료 구현 목록이 아니다.
- **Restate 결과 보존:** 완료 출력의 1시간 보존을 유지한다. DB에 상영·티켓이 확정되면 생성은 완료된다. 만료 후 410 응답, 영구 결과 조회·재실행 장치는 추가하지 않는다. 이전 5번은 필수 작업에서 제외한다.
- **유지하는 선택:** `getMany`·`deleteMany`, 기존 common 유틸, 100% 커버리지·반복 CI, Dev Container reset·`free-port`는 유지한다. Restate·JetStream 예제의 존재도 제거 이유가 아니다. 이것이 개별 구현을 모두 유지해야 한다는 뜻은 아니다.

## 필수 작업으로 채택하지 않은 제안

문제가 없어졌다는 뜻은 아니다. 아래의 현재 한계를 확인했지만, 이를 모두 구현하는 것은 추천하지 않는다. 별도 요구가 생기면 다시 판단한다.

| 이전 제안                                       | 현재 판단                                                                                                                                                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7·16: 복제본별 경쟁·실행 중단 검증 확대         | 일부 race는 전체 요청의 복제본 수만 확인한다. 가입 chaos와 별도 Restate counter 복구 테스트도 구매·상영 실행 도중 API 종료를 직접 검증하지 않는다. 이 한계는 문서에 반영하되, worker 관측·새 장애 시나리오를 필수 작업으로 늘리지 않는다. |
| 13: 비밀번호 72-byte 상한                       | 입력·인증 계약을 바꾸는 별도 제안이다. 이번 정리를 근거로 새 제한이나 관련 테스트를 추가하지 않는다.                                                                                                                                      |
| 14: 데모 BFF의 최초 연결 실패를 JSON 502로 통일 | 두 앱 모두 최초 `callApi`의 실패를 따로 변환하지 않는다. 데모에서 해당 응답 형식이 필요할 때 앱 안에서 작게 처리할 수 있으며, common 프록시나 대규모 테스트로 확대하지 않는다.                                                            |
| 17: API 문서의 본문 단언 확대                   | `purchases.spec`는 상태 코드만 확인하지만 [구매 통합테스트](../apps/api/src/__tests__/application/purchase.spec.ts)는 최초·재응답 본문과 결제 1회를 이미 검증한다. 본문 검증을 shell spec 전체에 복제할 필요는 없다.                      |
| MongoDB 결과 불확실성 공통 처리                 | [이전 단순화 검토](../docs/backup/reviews/repository-simplification-review.md)의 공통 오류 분류·재조회 전략은 채택되지 않은 설계안이다. 구체적인 필요 없이 범용 복구 계층을 추가하지 않는다.                                              |

## 더 이전에 삭제된 기록

삭제 직전 원문도 복구해 보관한다. 아래는 검토 이력과 참고 자료이며 진행할 작업 목록이 아니다. 보관본의 내용과 옛 링크는 수정하지 않는다.

| 기록                                                                                  | 복구 출처                                       |
| ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [외부 테스트 재검토](../docs/backup/reviews/tests-review.md)                          | `5f876281^:_todo/tests-review.md`               |
| [지원 영역 정리](../docs/backup/reviews/support-cleanup.md)                           | `18a3307c^:_todo/support-cleanup.md`            |
| [테스트 파일 인벤토리](../docs/backup/reviews/test-inventory.md)                      | `18a3307c^:_todo/test-inventory.md`             |
| [문서 검토 보고서](../docs/backup/reviews/documentation-review.md)                    | `42ffa218^:_todo/documentation-review.md`       |
| [k6 설치 사례](../docs/backup/reviews/k6-installation-case-study.md)                  | `f124e404^:_todo/k6-installation-case-study.md` |
| [NATS JetStream 테스트 경합 사례](../docs/backup/reviews/nats-jetstream-test-race.md) | `f124e404^:_todo/nats-jetstream-test-race.md`   |

예전 `_todo/docs-recovery/`의 설계·네이밍 문서 원문은 [docs/backup/recovered](../docs/backup/recovered/README.md)에 보관돼 있다.
