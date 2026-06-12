# 컨벤션 — 횡단 약속

폴더 하나에 속하지 않는, 저장소 전체에 적용되는 약속을 둔다. 코드 컨벤션(이름 짓기, 에러 규칙, 가져오기, REST API 설계, 데이터 비정규화, Type vs Interface)은 [apps 문서](../apps.md#코드-컨벤션)에 있다.

---

## 1. 커밋 메시지

[`@commitlint/config-conventional`](https://github.com/conventional-changelog/commitlint) 규칙을 따른다. `commit-msg` 훅이 강제하므로 규칙을 어기면 commit이 거절된다. `pre-commit` 훅은 staged 파일에 ESLint `--fix`와 Prettier를 자동 적용한다(lint-staged).

형식은 `type(scope): subject`이다. 사용할 수 있는 type은 `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `style`이다.

예: `feat: add user login`, `fix(api): handle null pointer in auth`

---

## 2. 실패는 빨리 드러낸다

문제를 덮는 폴백 대신, 잘못된 상태를 그 자리에서 명시적으로 실패시킨다. 폴백은 오류를 뒤로 미루고, 미뤄진 오류는 원인에서 먼 곳에서 엉뚱한 모습으로 나타난다.

- 셸 스크립트의 필수 변수는 `${VAR:?}`로 선언한다. 비어 있으면 그 줄에서 죽는다.
- 앱은 부팅할 때 Joi 스키마로 `process.env`를 검증한다. 값이 빠지면 서버가 뜨지 않는다.
- 코드에서 "반드시 있어야 하는" 값은 `Require.defined`·`ensure`로 단언한다. 임의의 기본값을 만들어 계속 진행하지 않는다.
- 정리 작업이 대상을 못 찾으면 조용히 넘어가지 않고 예외를 던진다. 무음 no-op은 성공처럼 보이는 실패다.

---

## 3. 값은 어디에 두나

환경마다 달라지는 값만 환경 변수로 받는다. 접속 정보, 포트, 시크릿이 여기에 속하고, 부팅할 때 검증한다. 흐름은 [환경 변수](environment.md)에 있다.

도메인 정책 값은 코드에 둔다. 홈 화면의 영화 수, 정리 cron 주기, 티켓 가격 기본값처럼 환경별로 바꿀 일이 없는 값은 사용하는 코드 옆의 상수나 설정 스키마의 기본값으로 적는다. 모든 값을 env로 빼면 설정 파일이 두 번째 코드베이스가 된다.

---

## 4. npm 스크립트 계약

루트 package.json이 진입점이다. 루트는 동사를 워크스페이스로 팬아웃하고(`npm run <동사> --workspaces --if-present`), 각 워크스페이스는 자기가 지원하는 동사만 같은 이름으로 구현한다. 보조 단계는 npm의 pre/post 훅(`prelint`, `postformat`, `preatoz`)으로 잇는다. 워크스페이스에 속하지 않는 파일의 검사(저장소 전체 Prettier, 셸 스크립트 shellcheck, 문서 내부 링크 lychee)는 `prelint`가 맡는다 — `lint`와 `atoz`가 모두 이 경로를 지난다.

| 동사     | 의미                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------- |
| `dev`    | watch 모드 실행                                                                                       |
| `build`  | 빌드 산출물 생성                                                                                      |
| `test`   | 개발 루프용 빠른 회귀. devcontainer 인프라를 재사용하는 Jest                                          |
| `lint`   | 타입 체크 + ESLint + Prettier 검사. 루트 prelint가 shellcheck·문서 링크 검사를 더한다                 |
| `format` | ESLint `--fix` + Prettier 쓰기                                                                        |
| `e2e`    | 콘솔 브라우저 시나리오 (tests/console-e2e)                                                            |
| `atoz`   | 클린룸 전체 회귀 — clean·인프라 리셋·`npm ci` 후 lint·build·test·e2e·배포 검증까지. `test`를 포함한다 |
| `clean`  | (루트 전용) `git clean -fdX`로 추적되지 않는 파일 정리                                                |

`atoz`의 워크스페이스 구현은 "그 워크스페이스를 전부 검증한다"는 의미만 같고 단계는 각자 다르다. libs는 build→lint→test, Next 앱은 테스트가 없어 lint→build, api는 배포 검증에서 Docker가 빌드를 맡으므로 lint→test다.
