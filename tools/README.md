# tools/ — 개발·테스트 실행 도구

## 1. vitest-helpers — 테스트 자원 준비와 정리

Vitest 설정·setup·teardown은 소스 변환 전에도 실행되므로 별도 빌드가 필요 없는 CommonJS와 타입 선언으로 제공한다.

테스트 패키지가 DB·버킷 이름을 정하고 helper가 worker별로 준비한 뒤 정리한다. 공유 인프라에서는 테스트 패키지가 지정한 이름에 해당하는 자원만 삭제한다. 한 파일의 앱 context들은 MongoClient를 공유하므로 그 파일의 테스트가 모두 끝날 때 연결을 닫는다. [API의 준비·정리 설정](../apps/api/src/__tests__/vitest.setup.ts)과 [자원 이름](../apps/api/scripts/vitest-resource-wiring.cjs)을 참고한다.

## 2. dev-tools — 명시적으로 실행하는 개발 도구

`pnpm run dev`는 API와 web을 시작하기 전에 `free-port`로 각 포트를 사용 중인 프로세스를 종료한다.

개발 서버를 실행한 뒤 다른 터미널에서 `pnpm exec tunnel`을 실행한다. 출력된 HTTPS 주소로 접속하면 브라우저가 사진 체크섬 계산에 쓰는 Web Crypto를 사용할 수 있다. 터널은 web 포트만 공개하고 API 요청은 web의 프록시가 전달한다. 터널을 닫으려면 `Ctrl+C`를 누른다.

## 3. Compose로 실행하는 도구

`pnpm run lint:links`는 lychee로 문서의 내부 링크와 제목 링크를 검사한다. `pnpm run benchmark`는 k6로 API에 부하를 준다. 두 명령은 [별도 Compose 프로젝트](compose.yml)의 일회성 컨테이너를 사용하므로 개발 인프라를 유지한 채 종료할 수 있다.
