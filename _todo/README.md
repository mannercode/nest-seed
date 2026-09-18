# 할 일

`apps/api`와 `libs/`를 중심으로 시드에 필요한 미완료 작업을 관리한다.

- [ ] **CI에서 빠진 스크립트의 lint를 연결한다.** [루트](../package.json)의 `lint:root`는 형식·링크·shell만 검사한다. `vitest.config.base.mjs`, `tools/dev-tools/free-port.js`, `libs/common/vitest.global.cjs`·`vitest.teardown.cjs`는 workspace의 Oxlint 대상에서도 빠져 있다. 기존 Oxlint 설정과 `lint`·`atoz` 진입점에 포함하면 된다. 새 도구·규칙·테스트는 필요 없다.
- [ ] **[문서의 남은 불일치와 표현](docs-reference-review.md)을 정리한다.** env 주입 방식, MongoDB 설명, 실제 테스트가 확인하는 범위와 개발 규칙의 표현을 맞춘다. 코드 변경을 마친 뒤 진행할 문서 작업이다.
