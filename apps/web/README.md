# 웹 앱

사진을 첨부해 가입하고 로그인한 사용자가 본인 정보를 조회하는 화면을 제공한다. 브라우저는 웹 앱의 프록시를 통해 API를 호출한다. [화면과 프록시](src/app/)

웹 서버에는 API와 같은 `S3_ENDPOINT`와 `S3_BUCKET`을 지정한다. 사진 프록시는 이 저장소의 지정된 버킷으로만 업로드·다운로드 요청을 전달한다. 버킷이 경로에 있는 주소와 호스트명에 있는 주소를 모두 지원한다. 기본 Compose에서는 `s3`와 `<버킷>.s3`가 같은 게이트웨이를 가리킨다. 외부 저장소를 호스트명 방식으로 쓰려면 웹 서버에서 해당 버킷의 호스트에 접속할 수 있어야 한다. [사진 프록시](src/app/storage/route.ts) · [S3 Compose 설정](../../infra/compose.s3.yml)

## 브라우저 E2E

저장소 루트에서 `pnpm -C apps/web test`를 실행한다. 실행기는 워크스페이스의 앱 컨테이너를 내린 뒤 같은 Compose 프로젝트에 E2E 설정을 적용한 `api`와 `web`을 띄운다. Playwright 컨테이너에서 Chromium으로 프로덕션 빌드를 검증한 뒤 앱을 내린다. Playwright 이미지 태그는 웹 앱에 설치된 `@playwright/test` 버전을 따른다. [E2E 설정](tests/compose.e2e.yml) · [실행기](tests/run-e2e.sh)

웹 E2E와 복제본 검증은 각각 전용 `PROJECT_ID`와 workflow 주소를 사용한다. Restate가 개발 서버의 새 작업을 종료된 테스트 컨테이너로 보내지 않도록 각 환경의 workflow 이름을 구분한다.

`test.only`는 로컬과 CI 모두에서 실패한다. [Playwright 설정](tests/playwright.config.ts)
