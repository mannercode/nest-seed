# tools/ — 개발·테스트 실행 도구

앱의 런타임 기능은 `libs/common`, spec이 직접 쓰는 client·fixture는 `libs/testing`에 둔다. `tools/`는 앱 밖에서 개발 명령을 실행하거나 테스트 환경을 부팅하는 코드다. 배포용 앱의 의존성으로 가져오지 않는다.

## 1. vitest-helpers — 테스트 환경의 수명

Vitest config·global setup·setupFiles·teardown은 앱 소스가 변환되기 전에도 실행되어야 한다. 그래서 `vitest-helpers`는 별도 TypeScript 빌드가 필요 없는 CommonJS와 타입 선언으로 제공한다. helper를 빌드하려고 테스트 환경부터 필요해지는 순환을 피한다.

helper는 worker별 MongoDB·S3 준비와 테스트 뒤 정리 순서를 관리한다. 연결 생성과 자원 이름의 구체적인 범위는 호출하는 workspace가 정한다. API는 개발 인프라를 공유하므로 자기 접두사에 해당하는 자원만 정리한다. 실행 전용 Testcontainers Redis의 전체 정리는 호출자가 명시한 경우에만 허용한다.

API의 앱 context 종료와 파일이 공유하는 MongoClient 종료도 다른 수명이다. 하나의 테스트가 공유 연결을 닫아 다음 테스트를 깨뜨리지 않도록 수명 소유자를 유지한다. 실제 사용은 [API setup](../apps/api/src/__tests__/vitest.setup.ts)과 [자원 배선](../apps/api/scripts/vitest-resource-wiring.cjs)을 본다.

## 2. dev-tools — 명시적으로 실행하는 개발 도구

`free-port`는 개발 서버가 사용할 포트를 정리하고, `tunnel`은 console·user-app을 Quick Tunnel로 공개한다. 두 명령은 앱이 실행 중에 호출하는 기능이 아니라 개발자의 실행 도구다.

현재 `pnpm exec tunnel`은 두 frontend의 개발 포트를 공개한다. BFF가 API로 요청을 전달하므로 frontend 화면만 공개된다고 생각해서는 안 된다. 최종 권한 검사는 API guard가 담당한다. 사용 후 프로세스를 끝내면 함께 시작한 tunnel도 정리된다.

독립 스크립트와 실행 도구는 `common` 빌드에 의존시키지 않는다. Node·SDK를 직접 쓰는 것이 허용되는 이 범위를 `apps/api/src`의 런타임 연동 규칙과 혼동하지 않는다.

## 3. Compose로 실행하는 도구

lychee와 k6는 `tools/compose.yml`의 일회성 컨테이너로 실행한다. 루트의 `pnpm compose:tools`가 공통 진입점이며 `${COMPOSE_PROJECT_NAME}-tools` project를 사용한다. 인프라·web project의 컨테이너를 같은 Compose 묶음으로 오인하지 않도록 project는 나누고, `DEVCONTAINER_NETWORK`의 기존 네트워크를 공유한다.

- lychee는 `lint:root`가 저장소 내부 문서 링크와 fragment를 검사할 때 실행한다. `--offline`은 외부 사이트의 가용성 때문에 lint가 흔들리지 않게 검사 범위를 정한 옵션이다.
- k6는 benchmark 실행기가 API 스택과 결과 디렉터리에 연결해 실행한다. 출력 파일은 Dev Container 사용자 권한으로 남긴다.

두 도구의 작업 디렉터리와 bind mount는 [DooD의 경로 계약](devcontainer.md#2-docker-outside-of-docker의-경로-계약)을 따른다. 도구 실행 종료와 개발 인프라의 파괴적 reset은 별개다.
