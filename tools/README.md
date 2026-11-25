# tools/ — 개발·테스트 실행 도구

## 1. vitest-helpers — 테스트 자원 준비와 정리

API와 common 테스트는 `@mannercode/tools/vitest-helpers`에서 준비·정리 함수를 가져온다. Vitest가 소스 변환 전에 불러올 수 있도록 CommonJS와 타입 선언으로 제공한다.

DB와 버킷은 worker별로 준비한다. 같은 파일의 테스트들은 MongoClient를 공유하며 마지막 테스트가 끝나면 연결을 닫는다. 전체 테스트가 끝나면 API는 공유 인프라에서 자기 테스트 자원만 지우고, common은 이번 실행에서 시작한 컨테이너를 종료한다. [API 테스트 자원](../apps/api/src/__tests__/helpers/resources.ts) · [common 테스트 컨테이너](../libs/common/vitest.global.cjs)

## 2. 개발 포트와 HTTPS 터널

API와 web은 지정한 포트에서 시작한다. 포트를 이미 사용 중이면 해당 프로세스를 확인하고 종료하거나 실행 설정에서 포트를 바꾼다.

외부에서 web에 접속하려면 개발 서버를 켜고 다른 터미널의 저장소 루트에서 `pnpm exec tunnel`을 실행한다. 출력된 HTTPS 주소에서는 사진 체크섬 계산에 필요한 Web Crypto를 사용할 수 있다. 터널은 web 포트만 공개하고 API 요청은 web이 전달한다.

## 3. 문서 링크와 셸 스크립트 검사

루트의 `pnpm run lint`는 두 검사를 모두 실행한다. 각각 실행하려면 다음 명령을 사용한다.

- `pnpm run lint:md`는 lychee를 일회성 컨테이너로 실행해 로컬 링크와 문서 내 제목 링크를 검사한다. 저장소 루트부터 숨김 폴더까지 `.md` 파일을 찾으며 `.gitignore`를 따른다. [루트 스크립트](../package.json)
- `pnpm run lint:shell`은 Git이 추적하는 `*.sh` 파일과 `.husky/` 훅, API 예제의 셸 설정·fixture·spec을 ShellCheck로 검사한다.
