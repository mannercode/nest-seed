---
name: Review scope spans docs/configs/tests/scripts, not just code
description: 프로젝트 검토 시 코드 외에 문서·설정·테스트·스크립트도 포함하고, 가독성·간결성 기준을 함께 본다
type: feedback
originSessionId: 4feaead6-5c0f-4a90-a339-97849cbed5ed
---
이 프로젝트(또는 비슷한 monorepo)에서 "개선할 거 검토" 작업을 받으면 다음 차원을 모두 본다:

1. **코드/스크립트** — 버그·정확성뿐 아니라 *장황하지 않은지* (verbose, redundant, over-abstracted) 도 본다.
2. **문서 (README, docs/*.md)** — 단순히 내용만 보지 말고 *사람이 읽기 쉬운지* 본다. 흐름이 매끄러운지, 중복 설명이 있는지, 불필요한 장황함이 없는지.
3. **설정 (eslint, tsconfig, jest config, package.json scripts)** — 중복·dead config가 없는지.
4. **테스트** — 보일러플레이트 중복, 겉도는 단언, 의도가 모호한 케이스.

**Why:** 사용자 피드백 — "이 프로젝트에 코드만 있는 건 아니다. 문서/설정/테스트 등등 많이 있다. 문서도 단순히 내용만 볼게 아니라 사람이 읽기 쉬운지 봐야 한다. 코드나 스크립트는 장황하지 않은지도 살펴봐라". 즉 검토 대상이 코드에만 한정되는 것이 아니고, 평가 기준에 *간결성·가독성*이 포함된다.

**How to apply:** 검토 라운드를 코드만 보고 종료하지 않는다. 1~N차 라운드를 순회하면서 매 라운드마다 다른 차원을 본다 (예: R1 코드 버그 → R2 문서 가독성 → R3 테스트 중복 → R4 설정 dead config).
