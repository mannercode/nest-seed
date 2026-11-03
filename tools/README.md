# tools/ — 개발·테스트 실행 도구

개발 명령과 테스트 환경을 준비하는 코드다. 앱의 런타임 연동은 `libs/common`, spec·fixture의 client는 `libs/testing`에 둔다. 앱이 tools를 운영 의존성으로 가져오지는 않는다.

## 1. vitest-helpers — 테스트 자원 준비와 정리

Vitest 설정·setup·teardown은 소스 변환 전에도 실행되므로 별도 빌드가 필요 없는 CommonJS와 타입 선언으로 제공한다.

workspace가 접속 정보·DB·bucket 이름을 정하고 helper가 worker별 자원을 준비·정리한다. 공유 인프라에서는 테스트에 지정한 접두사의 MongoDB·S3 자원만 정리한다. 테스트 전용 Testcontainers Redis도 호출자가 전체 삭제를 명시했을 때만 모두 지운다.

한 테스트 파일의 앱 context들은 MongoClient를 공유하므로 개별 context가 아니라 파일의 모든 테스트가 끝날 때 연결을 닫는다. 설정은 [API setup](../apps/api/src/__tests__/vitest.setup.ts)과 [자원 구성](../apps/api/scripts/vitest-resource-wiring.cjs)에 있다.

## 2. dev-tools — 명시적으로 실행하는 개발 도구

`free-port`는 개발 포트를 점유한 프로세스를 종료한다. 조회 직후 사라진 프로세스만 무시하고 명령·권한 오류는 실패로 반환한다.

개발 서버 실행 후 루트에서 `pnpm exec tunnel`을 실행하면 cloudflared가 `WEB_PORT`의 web을 HTTPS Quick Tunnel로 공개한다. API 호출은 web BFF를 거치므로 API 포트를 별도로 공개할 필요는 없다. 종료하면 함께 시작한 tunnel 프로세스도 정리한다. 쿠키·IP 헤더·권한 처리는 [BFF 조건](../apps/README.md#web과-bff)을 따른다.

독립 도구는 common 빌드 없이 실행하도록 Node·SDK를 직접 사용할 수 있다.

## 3. Compose로 실행하는 도구

[compose.yml](compose.yml)의 lychee·k6는 `pnpm compose:tools`로 실행하는 일회성 컨테이너다. 기존 `DEVCONTAINER_NETWORK`를 사용하되 개발 인프라와 수명을 분리하려고 `${COMPOSE_PROJECT_NAME}-tools` 프로젝트로 실행한다. bind mount는 [호스트와 컨테이너의 같은 절대경로](../.devcontainer/README.md#2-호스트와-dev-container에서-같은-경로-사용)를 전제로 한다.

lychee는 `lint:root`에서 내부 문서·제목 링크를 검사한다. 외부 사이트 상태에 영향을 받지 않도록 오프라인으로 실행하며 `_todo/`는 제외한다. benchmark 실행기는 k6를 API 스택에 연결하고 결과를 Dev Container 사용자 권한으로 작성한다.
