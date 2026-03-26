---
name: Monorepo migration
description: Project was originally 3 separate repos, now merged into a monorepo structure
type: project
---

Originally 3 separate repositories, now consolidated into a single monorepo.

- `templates/` — mono, msa (메인 프로젝트. 시드 프로젝트로 여기저기 활용)
- `packages/` — common, microservice, testing (templates가 참조하는 라이브러리. 시드 프로젝트에서 사용하기 위해 npm 배포)

templates가 packages 소스를 직접 참조 (tsconfig paths → `../../packages/*/src`).
packages는 templates를 위해 존재하며, npm 배포는 시드 프로젝트에서 사용하기 위함.

**Why:** 3개 repo 관리 번거로움 해소 + 시드 프로젝트에 packages npm 배포 필요.
**How to apply:** templates가 메인. packages 변경 시 templates 빌드 영향 확인 필수.
