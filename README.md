# nest-seed

NestJS 백엔드 프로젝트를 시작하기 위한 템플릿이다. 예제로 사진 첨부 가입, 사용자별 SSE 메시지 전달, 비동기 작업 제출과 결과 조회를 제공한다.

함께 제공하는 인프라는 개발·검증용이다. 포크할 때는 프로젝트명 `nest-seed`와 조직명 `mannercode`(패키지 scope `@mannercode` 포함)를 바꾼다.

## 시작하기

1. Docker 호스트의 저장소를 VS Code Remote SSH로 열고 `Reopen in Container`를 실행한다. 호스트의 `USER`와 폴더명으로 구성되는 Compose 프로젝트명은 소문자나 숫자로 시작하고 이후에는 `-`·`_`도 허용한다. 같은 사용자로 여러 복사본을 열 때는 폴더명을 다르게 둔다.
2. Dev Container가 의존성을 설치하고 `pnpm -C infra run reset`으로 빈 개발 환경을 준비한다. 준비가 끝나면 컨테이너 터미널 두 개에서 각각 `pnpm -C apps/api run dev`와 `pnpm -C apps/web run dev`를 실행한다. [시작 설정](.devcontainer/devcontainer.json)
3. 같은 컨테이너에서 `curl -fsS "http://localhost:${API_PORT:?}/health"`를 실행한다. API가 준비됐으면 HTTP 200을 반환하고 JSON의 `status` 값이 `"ok"`다. `echo "$WEB_PORT"`로 확인한 포트를 VS Code 포트 패널에서 전달해 웹 앱을 연다. [상태 응답 테스트](apps/api/src/__tests__/health.spec.ts)

외부 기기에서 사진을 첨부해 보려면 두 개발 서버를 켠 채 루트에서 `pnpm exec tunnel`을 실행한다. 출력된 HTTPS 주소에서는 브라우저가 Web Crypto로 사진 체크섬을 계산할 수 있다. [터널 스크립트](tools/tunnel.sh)

### 환경 변수 파일 변경 후 Dev Container 재생성

개발 서비스의 주소·포트는 [infra/.env.infra](infra/.env.infra)에서, API의 인증·로그 설정은 [infra/.env.api](infra/.env.api)에서 바꾼다. Dev Container와 Compose의 API 컨테이너가 두 파일을 읽어 프로세스에 전달한다. Docker가 값을 그대로 읽으므로 `API_PORT=3000`처럼 따옴표나 다른 변수 참조 없이 적는다. 두 파일 중 하나를 수정한 뒤에는 VS Code에서 `Rebuild Container`를 실행한다.

## 실행과 검증

Dev Container의 저장소 루트에서 실행한다.

| 확인할 내용                                                                            | 명령                                 |
| -------------------------------------------------------------------------------------- | ------------------------------------ |
| [CI와 같은 전체 검사](.github/workflows/lint-test.yaml)                                | `pnpm run lint && pnpm test`         |
| [API 문서의 전체 curl 예제](apps/api/README.md#실행-가능한-api-문서)                   | `pnpm -C apps/api run test:api-docs` |
| [브라우저에서 가입·로그인하고 내 정보 조회](apps/web/tests/e2e/user-auth-flow.spec.ts) | `pnpm -C apps/web test`              |

컨테이너를 쓰는 테스트와 벤치마크는 워크스페이스에서 한 번에 하나씩 실행한다. 개발 API도 같은 인프라에 연결되므로, 검사 중에 보낸 개발 요청은 테스트 데이터에 영향을 줄 수 있다. [환경 전환 스크립트](infra/stack.sh)

이미 실행 중인 개발 API로 curl 예제를 확인하고 보고서를 남기려면 `bash apps/api/api-docs/run.sh`를 실행한다. [대상 API 주소 지정](apps/api/api-docs/run.cfg) · [외부에 전달할 실행 예제 묶음](apps/api/README.md#실행-가능한-api-문서)

### 앱 컨테이너와 복제본 검증

| 실행할 구성                     | 명령                              |
| ------------------------------- | --------------------------------- |
| API와 웹 앱, 의존 서비스        | `pnpm -C infra run apps:up`       |
| API와 의존 서비스               | `pnpm -C infra run apps:up api`   |
| NGINX, API 복제본과 의존 서비스 | `pnpm -C infra run apps:up nginx` |

NGINX는 호스트 포트를 점유하므로 같은 Docker 호스트에서는 한 프로젝트씩 복제본을 띄운다. 수동 검증을 끝내면 `pnpm -C infra run apps:down`으로 기본 개발 환경을 복구한다. [Compose 설정](infra/compose.yml)

`pnpm -C infra run race`로 시나리오 목록을 확인한다. `pnpm -C infra run race sse-fanout-race`는 여러 API 복제본에 연결한 사용자가 자신의 SSE 메시지만 받는지 검사한다. [Race 시나리오](infra/tests/api/race/scenarios/)

`pnpm -C infra run benchmark`는 로그인한 사용자의 본인 정보 조회·수정 성능을 측정한다. 명령이 출력한 `report.html`과 `summary.json`에서 처리량·실패율·지연시간을 확인한다. [벤치마크 요청과 지표](infra/tests/api/benchmark/crud.js)

### Restate 배포 주소

`RESTATE_DEPLOYMENT_URI`에는 Restate가 접근할 workflow 주소를 지정한다. 같은 버전의 API 복제본은 로드 밸런서 주소 하나를 공유한다. 진행 중인 작업을 유지하며 배포하려면 새 버전을 별도 주소에 등록하고, 기존 작업이 끝날 때까지 이전 주소에서 이전 코드를 실행한다. [배포 주소 설정](infra/compose.yml) · [재시작 후 복구 검증](infra/tests/restate-journal-recovery.test.js)

## 구조와 선택

- API의 계층 간 의존 방향과 사진 첨부 가입을 Application에 둔 이유는 [SoLA 설계](apps/api/README.md#sola의-모듈-의존-방향)에서 확인한다.
- 웹 앱의 인증·사진 요청을 다룰 때는 [웹 프록시](apps/web/README.md)를, 여러 앱에서 사용하는 패키지를 변경할 때는 [공유 라이브러리 계약](libs/README.md)을 참고한다.
- 개발 서비스의 구성과 테스트 자원의 준비·정리는 각각 [인프라 Compose](infra/compose.yml)와 [Vitest 도우미](tools/vitest-helpers/index.js)에서 확인한다.
- 저장소 작업과 테스트 작성 규칙은 [AGENTS.md](AGENTS.md)를 따른다.
