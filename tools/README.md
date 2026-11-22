# tools/ — 개발·테스트 실행 도구

## 1. vitest-helpers — 테스트 자원 준비와 정리

Vitest가 소스 변환 전에 불러올 수 있도록 CommonJS와 타입 선언으로 제공한다.

DB와 버킷은 worker별로 준비하고, 종료할 때는 테스트 패키지가 지정한 자원만 삭제한다. 같은 파일의 테스트들은 MongoClient를 공유하며 마지막 테스트가 끝나면 연결을 닫는다. [API 테스트 설정](../apps/api/src/__tests__/vitest.setup.ts) · [자원 이름](../apps/api/scripts/vitest-resource-wiring.cjs)

## 2. dev-tools — 개발 포트와 HTTPS 터널

`pnpm run dev`는 API와 web을 시작하기 전에 `free-port`로 각 포트를 사용 중인 프로세스를 종료한다.

외부에서 web에 접속하려면 개발 서버를 켜고 다른 터미널에서 `pnpm exec tunnel`을 실행한다. 출력된 HTTPS 주소에서는 사진 체크섬 계산에 필요한 Web Crypto를 사용할 수 있다. 터널은 web 포트만 공개하고 API 요청은 web이 전달한다.

## 3. Compose로 실행하는 도구

링크 검사(lychee)와 벤치마크 부하 생성(k6)은 별도 Compose 프로젝트의 일회성 컨테이너에서 실행한다. [도구 구성](compose.yml)
