# tools/ — 개발·테스트 실행 도구

이 폴더는 앱 밖에서 개발 명령을 실행하거나 테스트 환경을 부팅하는 코드를 둔다. 앱 런타임의 공유 기능은 `libs/common`, spec이 사용하는 client·fixture는 `libs/testing`이 소유한다. 앱의 운영 의존성으로 tools를 가져오지 않는다.

## 1. vitest-helpers — 테스트 환경의 수명

Vitest 설정·global setup·teardown은 앱 소스가 변환되기 전에도 실행돼야 한다. 따라서 helper는 별도 빌드가 필요 없는 CommonJS와 타입 선언으로 제공한다. 테스트를 부팅하기 위해 테스트 환경에서 helper부터 빌드해야 하는 순환을 피한다.

연결과 자원 이름은 소비 workspace가 정하고 helper는 worker별 MongoDB·S3 준비와 정리 순서를 맡는다. API는 개발 인프라를 공유하므로 자기 접두사의 자원만 정리한다. 실행 전용 Testcontainers Redis의 전체 정리는 호출자가 명시한 경우에만 허용한다.

API 앱 context와 테스트 파일이 공유하는 MongoClient는 수명이 다르다. 테스트 하나가 공유 연결을 닫아 다음 테스트를 깨뜨리지 않도록 소유자를 유지한다. 배선은 [API setup](../apps/api/src/__tests__/vitest.setup.ts)과 [자원 설정](../apps/api/scripts/vitest-resource-wiring.cjs)을 본다.

## 2. dev-tools — 명시적으로 실행하는 개발 도구

`free-port`는 개발 서버가 사용할 포트의 리스너를 종료해 포트를 비운다. `tunnel`은 console·user-app을 Quick Tunnel로 공개하고 종료 시 함께 시작한 tunnel 프로세스를 정리한다. 앱이 요청을 처리하면서 호출하는 기능은 아니다.

frontend의 BFF가 API로 요청을 전달하므로 tunnel은 화면의 정적 파일만 공개하는 기능이 아니다. 최종 권한 검사는 API guard가 맡는다. BFF의 쿠키·요청 전달 경계는 [apps 가이드](apps.md)에 있다.

독립 스크립트와 개발 도구는 common 빌드에 의존시키지 않는다. 여기서 Node·SDK를 직접 사용하는 것은 `apps/api/src`의 연동 구현을 common에 두는 규칙과 다른 실행 경계다.

## 3. Compose로 실행하는 도구

lychee와 k6는 [tools/compose.yml](../tools/compose.yml)의 일회성 컨테이너로 실행한다. 루트 `pnpm compose:tools`가 `${COMPOSE_PROJECT_NAME}-tools` project를 사용하며, 기존 `DEVCONTAINER_NETWORK`에 연결한다. 개발 인프라의 수명과 도구 실행·종료를 분리하기 위해서다.

lychee는 `lint:root`에서 내부 문서 링크와 fragment를 확인한다. 외부 사이트 가용성 때문에 lint가 흔들리지 않도록 offline 검사하며 `_todo/` 문서와 과거 가이드 원문의 옛 링크는 제외한다. k6는 benchmark 실행기가 API 스택과 연결해 실행하고 Dev Container 사용자 권한으로 결과를 남긴다.

두 도구의 bind mount는 [호스트와 컨테이너의 같은 절대경로](devcontainer.md#2-docker-outside-of-docker의-경로-계약)를 전제로 한다. 도구 종료는 인프라 reset이 아니며 개발 데이터가 초기화됐다고 판단하지 않는다.
