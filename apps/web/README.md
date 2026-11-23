# 웹 앱

사진을 첨부해 가입하고 로그인한 사용자가 본인 정보를 조회하는 화면을 제공한다. 브라우저는 웹 앱의 프록시를 통해 API를 호출한다. [화면과 프록시](src/app/)

## 브라우저 E2E

저장소 루트에서 `pnpm -C apps/web test`를 실행한다. 앱 Compose에 E2E 설정을 더해 프로덕션 빌드의 `api`와 `web`을 테스트 전용 프로젝트에 띄운다. 같은 네트워크의 Playwright 컨테이너에서 Chromium을 실행하며 이미지 태그는 웹 앱에 설치된 `@playwright/test` 버전을 따른다. [E2E 설정](tests/compose.e2e.yml) · [실행기](tests/run-e2e.sh)

웹 E2E와 복제본 검증은 각각 전용 `PROJECT_ID`와 workflow 주소를 사용한다. Restate가 개발 서버의 새 작업을 종료된 테스트 컨테이너로 보내지 않도록 각 환경의 workflow 이름을 구분한다.

`test.only`는 로컬과 CI 모두에서 실패한다. [Playwright 설정](tests/playwright.config.ts)
