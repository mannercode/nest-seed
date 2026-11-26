# nest-seed

NestJS 백엔드 프로젝트를 시작하기 위한 템플릿이다. Next.js 웹 앱에서 사진을 첨부해 가입할 수 있고, API에는 사용자별 SSE 이벤트와 비동기 작업 제출·조회 예제가 있다.

## 시작하기

Docker 호스트의 저장소를 VS Code Remote SSH로 열고 `Reopen in Container`를 실행한다. 의존성 설치와 개발 인프라 준비가 끝나면 컨테이너의 저장소 루트에서 터미널 두 개를 열어 각각 실행한다. [Dev Container 설정](.devcontainer/devcontainer.json)

| 앱  | 실행                       | 확인                                                                                         |
| --- | -------------------------- | -------------------------------------------------------------------------------------------- |
| API | `pnpm -C apps/api run dev` | `curl -fsS "http://localhost:${API_PORT:?}/health"`가 HTTP 200과 `"status":"ok"`를 반환한다. |
| 웹  | `pnpm -C apps/web run dev` | `echo "$WEB_PORT"`로 확인한 포트를 VS Code 포트 패널에서 전달해 브라우저로 연다.             |

외부 기기에서 사진 업로드를 확인하려면 두 서버를 켠 채 `pnpm exec tunnel`을 실행하고 출력된 HTTPS 주소를 연다.

### 환경 설정

앱이 인프라에 접속할 주소·포트는 `infra/.env.infra`에서, API 인증·로그 설정은 `infra/.env.api`에서 바꾼다. 값은 따옴표나 변수 참조 없이 적고, 수정 후 VS Code에서 `Rebuild Container`를 실행한다. [인프라 환경 변수](infra/.env.infra) · [API 환경 변수](infra/.env.api)

## 실행과 검증

Dev Container의 저장소 루트에서 실행한다.

| 대상                        | 명령                                           |
| --------------------------- | ---------------------------------------------- |
| 전체 lint와 테스트 (CI)     | `pnpm run lint && pnpm test`                   |
| API 통합 테스트와 문서 예제 | `pnpm run build:libs && pnpm -C apps/api test` |
| API 문서의 전체 curl 예제   | `pnpm -C apps/api run test:api-docs`           |
| 웹 브라우저 E2E             | `pnpm -C apps/web test`                        |

API와 웹을 컨테이너로 띄우려면 `pnpm -C infra run apps:up`을, 개발 환경으로 돌아가려면 `pnpm -C infra run apps:down`을 실행한다. [복제본 검증과 벤치마크 명령](infra/package.json)

## 프로젝트 구조

- [API의 SoLA 설계와 통합 테스트 작성법](apps/api/README.md)
- [웹의 인증 쿠키와 사진 프록시](apps/web/README.md)
- [공유 라이브러리의 역할과 사용 계약](libs/README.md)
- [저장소 작업 주의사항과 테스트 작성 규칙](AGENTS.md)
