# tools/ — 개발·테스트 실행 도구

이 폴더에는 개발 명령을 실행하거나 테스트 환경을 준비하는 코드를 둔다. 앱 실행에 필요한 공통 코드는 `libs/common`에, spec에서 사용하는 client·fixture는 `libs/testing`에 둔다. 앱의 운영 의존성으로 tools를 가져오지 않는다.

## 1. vitest-helpers — 테스트 환경의 수명

Vitest 설정·global setup·teardown은 앱 소스가 변환되기 전에도 실행돼야 한다. 이 단계에서 helper를 별도로 빌드할 필요가 없도록 CommonJS와 타입 선언으로 제공한다.

각 workspace가 연결과 자원 이름을 정하고, helper가 worker별 MongoDB·S3 자원을 준비하고 정리한다. API 테스트는 개발 인프라를 공유하므로 자기 접두사가 붙은 자원만 정리한다. 해당 테스트 실행 전용으로 만든 Testcontainers Redis도 호출자가 명시한 경우에만 전체 데이터를 지운다.

테스트 파일에서 공유하는 MongoClient는 개별 API 앱 context보다 오래 유지해야 한다. 따라서 앱 context를 정리할 때 공유 연결을 닫지 않는다. 연결 설정은 [API setup](../apps/api/src/__tests__/vitest.setup.ts)과 [자원 설정](../apps/api/scripts/vitest-resource-wiring.cjs)을 본다.

## 2. dev-tools — 명시적으로 실행하는 개발 도구

`free-port`는 개발 서버가 사용할 포트를 점유한 프로세스를 종료한다. 조회 직후 사라진 프로세스만 무시하고, 명령·권한 오류는 실패로 전달한다.

저장소 루트에서 `pnpm exec tunnel`을 실행하면 console·user-app을 Quick Tunnel로 공개한다. 종료할 때는 함께 시작한 tunnel 프로세스도 정리한다.

tunnel로 공개한 화면에서는 BFF를 통해 API도 호출할 수 있다. 최종 권한 검사는 API guard가 맡으며, BFF의 쿠키 처리와 요청 전달 방식은 [apps 가이드](apps.md)에 있다.

독립 스크립트와 개발 도구는 common을 빌드하지 않아도 실행할 수 있어야 하므로 Node·SDK를 직접 사용할 수 있다. `apps/api/src`에서 외부 연동 구현을 common에 두는 규칙은 이 도구들에 적용하지 않는다.

## 3. Compose로 실행하는 도구

lychee와 k6는 [tools/compose.yml](../tools/compose.yml)의 일회성 컨테이너로 실행한다. 루트 `pnpm compose:tools` 명령은 기존 `DEVCONTAINER_NETWORK`에 연결하되 `${COMPOSE_PROJECT_NAME}-tools`라는 별도 프로젝트를 사용한다. 도구를 실행하거나 종료할 때 개발 인프라에 영향을 주지 않도록 분리한 것이다.

lychee는 `lint:root`에서 내부 문서 링크와 문서 내 제목 링크를 검사한다. 외부 사이트의 응답 여부가 lint 결과에 영향을 주지 않도록 오프라인으로 검사하며, `_todo/`와 과거 가이드 원문은 대상에서 제외한다. benchmark 실행기는 k6를 API 스택에 연결하고 결과 파일을 Dev Container 사용자 권한으로 작성한다.

두 도구의 bind mount는 [호스트와 컨테이너의 같은 절대경로](devcontainer.md#2-docker-outside-of-docker의-경로-계약)를 전제로 한다.
