---
name: TDD — 증상 재현 테스트를 먼저, 그다음 수정
description: 버그 수정 시 항상 실패 테스트를 먼저 작성해서 증상 재현 후 수정한다
type: feedback
originSessionId: 4feaead6-5c0f-4a90-a339-97849cbed5ed
---
이 프로젝트에서 버그를 수정할 때는 항상 *증상을 재현하는 실패 테스트를 먼저 작성*하고, 그 테스트가 실제로 깨지는 것을 확인한 뒤에 수정한다. 수정 후 테스트가 통과하는 것으로 회귀 방지를 입증한다.

**Why:** 사용자 피드백 — "항상 테스트 작성해서 증상 재현 후 해결이다. 이번에도 테스트를 먼저 작성해라." 이 코드베이스는 mock 거의 없이 Testcontainers로 통합 테스트를 구성하는 정책을 갖고 있고, 100% coverage threshold를 enforce하므로, 모든 변경은 테스트로 입증돼야 한다.

**How to apply:**
- 버그 수정/correctness 변경: 실패 테스트 → 확인 → 수정 → 통과 확인.
- 순수 cleanup (dead code 제거 등): 새 테스트 불필요. 기존 테스트가 통과하는지 확인.
- 기능 추가: TDD 사이클(red → green → refactor)을 동일하게 적용.
- 적용 순서: cleanup → bug fixes (낮은 위험 → 높은 위험).
