# nest-seed

NestJS 백엔드 프로젝트를 시작하기 위한 템플릿이다. 사진을 첨부해 가입하면 브라우저에서 시작한 요청이 웹 프록시와 API를 거쳐 사용자 계정과 사진 소유권으로 저장되는 흐름을 따라갈 수 있다. 이벤트 예제는 연결된 사용자에게 메시지를 보내고, 비동기 작업 예제는 요청이 끝난 뒤에도 작업 결과를 조회할 수 있게 한다. [API 설계](apps/api/README.md#sola의-모듈-의존-방향) · [웹 앱의 역할](apps/web/README.md)

함께 제공하는 인프라는 개발·검증용이다. 포크할 때는 프로젝트명 `nest-seed`와 조직명 `mannercode`(패키지 scope `@mannercode` 포함)를 바꾼다.

## 시작하기

**이 프로젝트의 개발 데이터는 임시 데이터다.** Dev Container를 시작하거나 `pnpm -C infra run reset`을 실행하면 기존 서비스와 볼륨을 지우고 빈 기본 인프라를 띄운다. 계정·세션·업로드 파일·메시지·작업 기록은 컨테이너 테스트나 앱 구성으로 전환할 때도 삭제된다. [Dev Container 시작 설정](.devcontainer/devcontainer.json) · [환경 전환 스크립트](infra/stack.sh)

1. Docker 호스트의 저장소를 VS Code Remote SSH로 열고 `Reopen in Container`를 실행한다. 호스트의 `USER`와 폴더명으로 구성되는 Compose 프로젝트명은 소문자나 숫자로 시작하고 이후에는 `-`·`_`도 허용한다. 같은 사용자로 여러 복사본을 열 때는 폴더명을 다르게 둔다.
2. 의존성 설치와 초기화가 끝나면 컨테이너 터미널 두 개에서 각각 `pnpm -C apps/api run dev`와 `pnpm -C apps/web run dev`를 실행한다.
3. 같은 컨테이너에서 `curl -fsS "http://localhost:${API_PORT:?}/health"`를 실행한다. API가 준비됐으면 HTTP 200을 반환하고 JSON의 `status` 값이 `"ok"`다. `echo "$WEB_PORT"`로 확인한 포트를 VS Code 포트 패널에서 전달해 웹 앱을 연다. [상태 응답 테스트](apps/api/src/__tests__/health.spec.ts)

외부 기기에서 사진을 첨부해 보려면 두 개발 서버를 켠 채 루트에서 `pnpm exec tunnel`을 실행한다. 출력된 HTTPS 주소에서는 브라우저가 Web Crypto로 사진 체크섬을 계산할 수 있다. API 요청은 웹 앱이 전달한다. [터널 스크립트](tools/tunnel.sh)

### 환경 변수 파일 변경 후 Dev Container 재생성

개발 서비스의 주소·포트는 [infra/.env.infra](infra/.env.infra)에서, API의 인증·로그 설정은 [infra/.env.api](infra/.env.api)에서 바꾼다. Dev Container와 Compose의 API 컨테이너가 두 파일을 읽어 프로세스에 전달한다. Docker가 값을 그대로 읽으므로 `API_PORT=3000`처럼 따옴표나 다른 변수 참조 없이 적는다. 두 파일 중 하나를 수정한 뒤에는 VS Code에서 `Rebuild Container`를 실행한다. 이때도 개발 데이터가 초기화된다.

## 실행과 검증

Dev Container의 저장소 루트에서 실행한다.

| 확인할 내용                                                                            | 명령                                                               |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [CI와 같은 전체 검사](.github/workflows/lint-test.yaml)                                | `pnpm run lint && pnpm test`                                       |
| [사용자 API 통합 테스트 한 파일](apps/api/src/__tests__/core/users.spec.ts)            | `pnpm run test:api:file apps/api/src/__tests__/core/users.spec.ts` |
| [사진 첨부 가입 curl 예제와 기대 HTTP 상태](apps/api/api-docs/users.spec)              | `pnpm -C apps/api run test:api-docs users.spec`                    |
| [브라우저에서 가입·로그인하고 내 정보 조회](apps/web/tests/e2e/user-auth-flow.spec.ts) | `pnpm -C apps/web test`                                            |

서비스 컨테이너를 쓰는 테스트와 벤치마크는 이 워크스페이스에서 한 번에 하나씩 실행한다. 각 테스트 묶음은 빈 환경에서 필요한 서비스만 띄우고 끝나면 컨테이너와 볼륨을 지운다. 빈 기본 개발 인프라는 실행한 명령이 끝날 때 한 번 복구한다. `pnpm test`로 여러 묶음을 실행할 때도 같고, 실패하거나 Ctrl+C로 중단해도 복구한다. Dev Container에서 직접 실행한 개발 API도 같은 서비스 주소를 쓰므로, 테스트 중 그 API로 요청을 보내면 테스트 데이터가 바뀔 수 있다.

복구 테스트에는 재시작할 Restate 하나만 필요하다. common은 단일 Redis처럼 개발 클러스터와 다른 연결 조건도 검증하므로, 개발 인프라를 내린 동안 자체 Testcontainers를 사용한다. [Restate 복구 테스트](infra/tests/restate-journal-recovery.test.js) · [common 테스트 환경](libs/common/vitest.global.cjs)

이미 실행 중인 개발 API로 curl 예제를 확인하고 보고서를 남기려면 `bash apps/api/api-docs/run.sh users.spec`를 실행한다. [대상 API 주소 지정](apps/api/api-docs/run.cfg) · [외부에 전달할 실행 예제 묶음](apps/api/README.md#실행-가능한-api-문서)

저장소 전체의 서식은 `pnpm exec prettier --write .`으로 정리한다. 개별 검사 명령은 `pnpm run`으로 확인한다.

### 앱 컨테이너와 복제본 검증

아래 명령 중 하나를 실행하면 기존 서비스와 볼륨을 지우고 선택한 구성을 띄운다. NGINX는 호스트 포트를 점유하므로 같은 Docker 호스트에서는 한 프로젝트씩 복제본을 띄운다. [Compose 설정](infra/compose.yml)

| 실행할 구성                     | 명령                              |
| ------------------------------- | --------------------------------- |
| API와 웹 앱, 의존 서비스        | `pnpm -C infra run apps:up`       |
| API와 의존 서비스               | `pnpm -C infra run apps:up api`   |
| NGINX, API 복제본과 의존 서비스 | `pnpm -C infra run apps:up nginx` |

수동 검증을 끝내면 `pnpm -C infra run apps:down`으로 빈 기본 인프라를 복구한다.

`pnpm -C infra run race`는 실행할 수 있는 시나리오와 명령을 출력한다. 가입과 토큰 갱신은 같은 이메일 또는 토큰으로 보낸 각 요청 묶음에 복제본이 둘 이상 참여해야 통과한다. `pnpm -C infra run race sse-fanout-race`는 대조 계정의 첫 메시지를 받은 뒤 주 계정이 발행한 메시지를 여러 복제본에서 모두 받는지 검사한다. 대조 계정의 마지막 메시지를 받을 때까지 관찰한 각 연결에 상대 계정의 메시지가 섞이면 실패한다. 복제본 장애 테스트는 각 구간에 완료된 요청의 초당 건수와 p95 지연시간, 가입 성공이 없었던 최장 시간을 출력한다. [Race 시나리오](infra/tests/api/race/scenarios/)

`pnpm -C infra run benchmark`는 가상 사용자별 계정 생성과 로그인을 마친 뒤 본인 정보 읽기·수정을 측정한다. 압축 비교에는 같은 크기의 프로필을 사용한다. 워밍업이 끝난 뒤 측정 구간 안에 응답이 완료된 요청으로 처리량·실패율·지연시간을 계산한다. 워밍업과 종료 유예 때 받은 응답도 상태와 압축 검사를 통과해야 한다. 측정 도중 만료될 세션은 워밍업에서 먼저 갱신한다. 측정 구간과 겹친 갱신 횟수는 `authRenewalsOverlappingWindow`로, 시나리오 전체에서 시작했지만 응답 처리를 끝내지 못한 본인 정보 요청 수는 `unfinishedRequests`로 확인한다. 각 실행의 `summary.json`에서 커밋·미커밋 변경 여부·Docker 실행 환경·이미지를 확인하고 같은 조건에서 반복한 결과를 비교한다. [벤치마크 요청과 지표](infra/tests/api/benchmark/crud.js)

### Restate 배포 주소

`RESTATE_DEPLOYMENT_URI`는 Restate가 API의 workflow 리스너에 접속할 주소다. Compose의 단일 API는 `http://api:${RESTATE_SERVICE_PORT:?}`를, 같은 버전의 복제본들은 로드 밸런서 주소 `http://replica-nginx:${NGINX_RESTATE_PORT:?}`를 등록한다. 중단된 작업을 재개할 때는 완료된 단계의 저장 결과를 다시 사용하므로 그 기록을 해석할 코드가 필요하다. 진행 중인 작업을 유지하며 배포하려면 새 버전을 별도 주소에 등록하고 기존 작업이 끝날 때까지 이전 주소에서 이전 코드를 실행한다. [배포 주소 설정](infra/compose.yml) · [재시작 후 복구 검증](infra/tests/restate-journal-recovery.test.js)

## 구조와 선택

- API의 계층 간 의존 방향과 사진 첨부 가입을 Application에 둔 이유는 [SoLA 설계](apps/api/README.md#sola의-모듈-의존-방향)에서 확인한다.
- 웹 앱의 인증·사진 요청을 다룰 때는 [웹 프록시](apps/web/README.md)를, 여러 앱에서 사용하는 패키지를 변경할 때는 [공유 라이브러리 계약](libs/README.md)을 참고한다.
- 개발 서비스의 구성과 테스트 자원의 준비·정리는 각각 [인프라 Compose](infra/compose.yml)와 [Vitest 도우미](tools/vitest-helpers/index.js)에서 확인한다.
- 저장소 작업과 테스트 작성 규칙은 [AGENTS.md](AGENTS.md)를 따른다.
