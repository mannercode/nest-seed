# nest-seed

NestJS 백엔드 프로젝트를 시작하기 위한 템플릿이다. 사진을 첨부해 가입하면 브라우저에서 시작한 요청이 웹 프록시와 API를 거쳐 사용자 계정과 사진 소유권으로 저장되는 흐름을 따라갈 수 있다. 이벤트 예제는 연결된 사용자에게 메시지를 보내고, 비동기 작업 예제는 요청이 끝난 뒤에도 작업 결과를 조회할 수 있게 한다. [API 설계](apps/api/README.md#sola의-모듈-의존-방향) · [웹 앱의 역할](apps/web/README.md)

함께 제공하는 인프라는 개발·검증용이다. 포크할 때는 프로젝트명 `nest-seed`와 조직명 `mannercode`(패키지 scope `@mannercode` 포함)를 바꾼다.

## 시작하기

**Dev Container를 시작할 때마다 이 프로젝트의 개발 계정, 세션, 업로드 파일, 메시지, 작업 기록이 삭제된다.** 수동으로 같은 초기화를 하려면 `pnpm -C infra run reset`을 실행한다. [Dev Container 시작 설정](.devcontainer/devcontainer.json) · [개발 인프라 초기화](infra/reset.sh)

1. Docker 호스트의 저장소를 VS Code Remote SSH로 열고 `Reopen in Container`를 실행한다. 호스트의 `USER`와 폴더명으로 구성되는 Compose 프로젝트명은 소문자나 숫자로 시작하고 이후에는 `-`·`_`도 허용한다. 같은 사용자로 여러 복사본을 열 때는 폴더명을 다르게 둔다.
2. 의존성 설치와 초기화가 끝나면 컨테이너 터미널 두 개에서 각각 `pnpm -C apps/api run dev`와 `pnpm -C apps/web run dev`를 실행한다.
3. 같은 컨테이너에서 `curl -fsS "http://localhost:${API_PORT:?}/health"`로 API를 확인한다. `echo "$WEB_PORT"`로 확인한 포트를 VS Code 포트 패널에서 전달해 웹 앱을 연다.

외부 기기에서 사진을 첨부해 보려면 두 개발 서버를 켠 채 루트에서 `pnpm exec tunnel`을 실행한다. 출력된 HTTPS 주소에서는 브라우저가 Web Crypto로 사진 체크섬을 계산할 수 있다. API 요청은 웹 앱이 전달한다. [터널 스크립트](tools/tunnel.sh)

### 환경 변수 파일 변경 후 Dev Container 재생성

개발 포트와 접속 설정은 루트의 [.env.infra](.env.infra)와 [.env.api](.env.api)에서 바꾼다. Docker가 값을 그대로 읽으므로 `API_PORT=3000`처럼 따옴표나 다른 변수 참조 없이 적는다. 두 파일 중 하나를 수정한 뒤에는 VS Code에서 `Rebuild Container`를 실행한다. 이때도 개발 데이터가 초기화된다.

## 실행과 검증

Dev Container의 저장소 루트에서 실행한다.

| 확인할 내용                                                                            | 명령                                                               |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [CI와 같은 전체 검사](.github/workflows/lint-test.yaml)                                | `pnpm run lint && pnpm test`                                       |
| [사용자 API 통합 테스트 한 파일](apps/api/src/__tests__/core/users.spec.ts)            | `pnpm run test:api:file apps/api/src/__tests__/core/users.spec.ts` |
| [사진 첨부 가입 curl 예제와 기대 HTTP 상태](apps/api/api-docs/users.spec)              | `pnpm -C apps/api run test:api-docs users.spec`                    |
| [브라우저에서 가입·로그인하고 내 정보 조회](apps/web/tests/e2e/user-auth-flow.spec.ts) | `pnpm -C apps/web test`                                            |

전체 테스트는 복구를 검증하면서 공유 Restate를 재시작한다. `test:api-docs`, 브라우저 E2E, Race 시나리오, Benchmark는 기존 앱 컨테이너를 내린 뒤 검증 환경을 띄운다. 이때 만든 계정·파일·작업 기록이 개발 인프라에 남을 수 있다. [Restate 복구 테스트](infra/tests/restate-journal-recovery.test.js)

이미 실행 중인 개발 API로 curl 예제를 확인하고 보고서를 남기려면 `bash apps/api/api-docs/run.sh users.spec`를 실행한다. [대상 API 주소 지정](apps/api/api-docs/run.cfg) · [외부에 전달할 실행 예제 묶음](apps/api/README.md#실행-가능한-api-문서)

저장소 전체의 서식은 `pnpm exec prettier --write .`으로 정리한다. 개별 검사 명령은 `pnpm run`으로 확인한다.

### 앱 컨테이너와 복제본 검증

개발 인프라에서 `pnpm -C infra run apps:up`은 API와 웹 앱을 띄운다. 명령 끝에 `api`를 붙이면 API만, `nginx`를 붙이면 NGINX와 API 복제본을 띄운다. 수동으로 구성을 바꾸기 전에는 `pnpm -C infra run apps:down`으로 기존 앱을 내린다. NGINX는 호스트 포트를 점유하므로 같은 Docker 호스트에서는 한 프로젝트씩 복제본을 띄운다. [앱 Compose 설정](infra/compose.apps.yml)

`pnpm -C infra run race`는 실행할 수 있는 시나리오와 명령을 출력한다. `pnpm -C infra run benchmark`는 본인 정보 읽기·수정의 처리량과 지연 시간을 측정한다. 결과를 비교할 때는 머신·이미지·데이터 조건을 맞춘다. [Race 시나리오](infra/tests/api/race/scenarios/) · [벤치마크 요청과 지표](infra/tests/api/benchmark/crud.js)

### Restate 배포 주소

`RESTATE_DEPLOYMENT_URI`는 Restate가 API의 workflow 리스너에 접속할 주소다. 단일 API는 자신의 주소를, 같은 버전의 복제본들은 하나의 로드 밸런서 주소를 등록한다. 중단된 작업을 재개할 때는 완료된 단계의 저장 결과를 다시 사용하므로 그 기록을 해석할 코드가 필요하다. 진행 중인 작업을 유지하며 배포하려면 새 버전을 별도 주소에 등록하고 기존 작업이 끝날 때까지 이전 주소에서 이전 코드를 실행한다. [배포 주소 설정](infra/compose.apps.yml) · [재시작 후 복구 검증](infra/tests/restate-journal-recovery.test.js)

## 구조와 선택

- API의 계층 간 의존 방향과 사진 첨부 가입을 Application에 둔 이유는 [SoLA 설계](apps/api/README.md#sola의-모듈-의존-방향)에서 확인한다.
- 웹 앱의 인증·사진 요청을 다룰 때는 [웹 프록시](apps/web/README.md)를, 여러 앱에서 사용하는 패키지를 변경할 때는 [공유 라이브러리 계약](libs/README.md)을 참고한다.
- 개발 서비스의 구성과 테스트 자원의 준비·정리는 각각 [인프라 Compose](infra/compose.yml)와 [Vitest 도우미](tools/vitest-helpers/index.js)에서 확인한다.
- 저장소 작업, 테스트 작성, 프로젝트 태스크 관리는 [AGENTS.md](AGENTS.md)를 따른다.
