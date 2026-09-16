# 과거 문서 보관

원문의 내용·파일 권한과 복구 출처를 보존한다. 문서 안의 코드·명령·링크와 검토 결과는 작성 당시 기준이며 현재 구현 지침이 아니다. 후속 검토는 [검토 메모](../review/README.md)에서 시작한다.

| 자료                                    | 출처                                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [축소 직전 문서](before-reduction/)     | 기존 `docs_backup/`의 10개 문서. 보관 커밋 `420a8c19`.                                                                                                                               |
| [삭제 이력에서 복구한 원문](recovered/) | 2026-02-25·2026-02-27 삭제분 19개 파일과 당시 복구·검토 기록. 파일별 출처 커밋·blob·권한은 [manifest](recovered/manifest.json), 복구 경위는 [당시 기록](recovered/README.md)에 있다. |
| [이전 코드 검토](reviews/)              | 기존 `_todo/repository-simplification-review.md`와 `_todo/seed-project-review.md`. 이동 전 내용은 커밋 `6626b593`에도 남아 있다.                                                     |

[런타임 복잡성 검토 원문](reviews/runtime-complexity-review.md)은 커밋 `39260cec`의 `docs/review/runtime-complexity-review.md`다. 반영 전 진단과 선택지를 보존하며, 남은 검토는 [JSON·DTO 자동 변환](../review/runtime-complexity-review.md)에 있다.

`cef0a18c`의 `_todo/`에 있던 [삭제 경합 분석](reviews/catalog-deletion-showtime-creation-race.md), [단순화 계획](reviews/runtime-simplification-plan.md), [reference 검토](reviews/docs-reference-review.md)도 원문 그대로 보관한다. 기존 보관본과 같은 내용이던 저장소 단순화·시드 전체 검토의 `_todo/` 중복본은 제거했다. 현재 판단과 남은 작업은 [할 일 목록](../../_todo/README.md)을 따른다.

더 이전에 `_todo/`에서 삭제된 검토 문서 6개도 `reviews/`에 복구했다. [할 일 목록](../../_todo/README.md#더-이전에-삭제된-기록)에서 각 원문과 복구 출처를 확인할 수 있다.

원문 안의 링크와 옛 설명도 그대로 보관한다. 내용 수정은 이 보관본이 아닌 현재 문서에서 한다.
