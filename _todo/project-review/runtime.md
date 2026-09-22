# 실행 환경·설정·독립 스크립트·API 문서 검토

최초 검토 기준: 2026-09-18. 당시 설정·의존성·컨테이너를 변경하지 않고 검토했다. 대상 목록 106개 중 텍스트 104개를 끝까지 읽었다. lockfile은 구조와 manifest 대응을 검사했고, PNG는 크기·checksum을 검사했다. 아래 근거는 최초 검토 당시 상태이며, 현재 반영·검증 결과는 [통합 목록](README.md)에 둔다.

## 우선 정리할 확실한 문제

### R1. 전체 CI lint에도 빠지는 실행 코드가 있다

상태: 완료. 루트 설정, common의 Vitest 준비·정리, frontend 설정, dev-tools를 기존 Oxlint·format 검사와 AtoZ에 포함했고 전체 lint가 통과했다.

- 근거: 루트 `package.json:17`의 `lint:root`는 Prettier·문서 링크·ShellCheck만 실행한다. `tools/dev-tools/package.json`에는 lint/atoz가 없고 `libs/common/package.json:15`는 `vitest.global.cjs`·`vitest.teardown.cjs`를 대상으로 넣지 않는다. 두 frontend의 `next.config.mjs`·`postcss.config.mjs`도 해당 workspace lint에서 빠진다. 루트 `vitest.config.base.mjs`, `oxlint.config.mts`, `commitlint.config.js`, `.lintstagedrc.cjs`도 CI의 Oxlint 대상으로 전달되지 않는다.
- 영향: hook의 lint-staged가 실행된 커밋만 우연히 검사된다. 설정 변경이 평소 소스와 같은 CI 정적 검사를 받는다고 볼 수 없다.
- 최소 개선: 기존 lint 명령의 대상만 보완한다. 새 테스트 체계·새 lint 패키지·coverage 확대는 필요 없다. 기존 `_todo`의 lint 누락 항목과 같은 문제다.

### R2. 실행기 정리 실패가 전체 성공으로 끝날 수 있다

상태: 완료. 세 실행기 모두 본 작업 실패를 보존하며, 본 작업 성공 후 Compose down 실패도 실패로 반환한다. 실제 cleanup 함수를 격리 실행해 성공·정리 실패·본 작업 실패·동시 실패의 종료 코드를 확인했다.

- 근거: `tests/api/runner.sh:15`, `tests/api/benchmark/run.sh:19`, `tests/web/run-e2e.sh:25`의 EXIT cleanup은 원래 exit code를 저장하고 `set +e`로 Compose down을 실행한 뒤 원래 code로 종료한다.
- 영향: 테스트가 성공하고 정리만 실패한 경우에도 exit 0이다. 다음 실행에 자원이 남는 원인을 이번 실행의 실패로 드러내지 않는다.
- 최소 개선: 본 작업이 실패했으면 그 code를 유지하고, 본 작업이 성공했으면 정리 실패 code를 반환한다. 새로운 retry·복구 절차·테스트 framework를 만들 일이 아니다. 현재 판정은 소스 제어 흐름으로 확인했으며 Docker 장애를 실제 주입하지 않았다.

### R3. 현재 env 문서 한 문장이 구현 이전 상태다

상태: 완료. [현행 Dev Container 가이드](../../docs/devcontainer.md#1-환경-변수는-재생성해야-반영된다)에 반영됐으며 아래 근거는 최초 검토 당시 설명이다.

- 근거: `docs/devcontainer.md:19` 부근은 루트 env 파일을 shell 실행기도 읽는다고 설명한다. 현재 reset/API/race/benchmark/web 실행기는 Dev Container 환경을 상속하며, API/web Compose는 `format: raw`로 전달한다.
- 개선: 새 가이드에는 생성 시 주입·변경 후 rebuild·raw literal 규칙을 설명한다. `apps/api/api-docs/.env`는 별도의 shell 설정이며 루트 두 파일과 혼동하지 않게 한 문장으로 구분한다. Docker 공식 문서상 `format: raw`는 Compose 2.30.0 이상이다: https://docs.docker.com/reference/compose-file/services/#format

## 동작을 늘리지 않고 줄일 후보

### R4. 상영 성공 뒤의 API-docs polling 두 개는 중복이다

상태: 반영 완료. workflow 성공 뒤 상영·티켓은 한 번 조회하고 없거나 부족하면 실패한다. 통합 검증 결과는 [통합 목록](README.md)을 따른다.

- 근거: `common.fixture:215`의 준비는 `wait_for_showtime_creation` 성공 뒤 `wait_for_showtime`을 호출한다. booking/purchases는 이어서 `wait_for_tickets`도 호출한다. 두 후속 함수는 각각 최대 30회 조회한다.
- 근거 소스: `ShowtimeCreationPersistenceService.validateAndCreate`와 `ShowtimeBulkCreatorService.create`는 상영·티켓·operation을 같은 transaction에서 생성하며 workflow는 완료 뒤 `succeeded`를 반환한다. Mongo 연결도 secondary read를 선택하지 않는다.
- 추천: workflow 상태 polling 하나를 유지하고 상영/티켓은 한 번 조회해 필요한 값이 없으면 실패시킨다. 완료 이후에도 아직 생성 중일 수 있다는 불필요한 기대를 제거한다. 조회 결과 전체를 검증하는 대형 계약 테스트로 확대할 필요는 없다.

### R5. 테스트 helper의 미사용 확장점과 Redis guard는 줄일 여지가 있다

상태: 검토·반영 완료. 미사용 `onAfterEach`·`extra`를 제거했다. Redis scope·pattern·최소 길이는 공유 Redis에서 허용할 정리 범위의 계약이므로 유지한다. factory와 공개 cleanup 함수의 검사는 서로 다른 진입점을 보호하므로 하나를 제거하지 않는다.

- 근거: `tools/vitest-helpers/index.js`의 `onAfterEach`, `createGlobalTeardown.extra`는 저장소에 사용처가 없다. helper는 실제로 API와 common의 두 배선에 사용되는데 Redis 정리에 별도 scope·pattern·16자 이상 검사 및 중복 검사가 붙어 있다.
- 추천: 미사용 hook부터 제거 후보로 둔다. Redis는 API 접두사만 지우는 안전한 범위를 유지하되, 16자라는 임의 조건과 두 표현을 동시에 받는 API가 필요한지 검토한다. 공유 Redis에서 flushall로 바꾸자는 뜻이 아니다. 범용 정리 라이브러리로 확장할 이유도 없다.

### R6. free-port는 유지하되 진단을 숨기지 않게 할 수 있다

상태: 반영 완료. `ss` 오류는 전달하고 kill은 `ESRCH`만 무시한다. listen 재확인은 `EADDRINUSE`만 대상으로 한다.

- 근거: `tools/dev-tools/free-port.js:29`의 ss 실패는 빈 PID 목록으로, `:46`의 모든 kill 실패는 이미 종료된 프로세스로 취급한다.
- 영향: 명령 부재나 권한 오류도 결국 'still busy'로만 보인다. 성공 판정을 직접 위조하지는 않으므로 R2보다 우선도가 낮다.
- 최소 개선: 포트 정리 자체와 짧은 listen 재확인은 유지하고, ss 실패는 원인을 보고하며 kill은 실제 프로세스 소멸 오류만 무시한다. 포트 관리 framework나 별도 서비스는 필요 없다.

## 재현성과 버전 관리

상태: 갱신·통합 검증 완료. 앱·Dev Container의 Node 이미지와 pnpm bootstrap을 함께 고정하고 lychee의 `latest`를 tag·digest로 바꿨다. npm은 Nest core 계열·Vitest/coverage·Restate SDK/client·AWS SDK를 함께 갱신했다. 아래 표는 최초 검토 기록이며 실제 선택 버전은 manifest·lockfile·이미지 설정이 기준이다.

Testcontainers Mongo의 최신 12.1.0에도 digest를 tag로 오인하는 shell 선택 코드가 남아 있어 기존 예외를 유지한다. peer dependency의 반복은 소비자 계약이므로 catalog로 옮기지 않으며 TSC·Rspack·Vitest의 별도 실행 목적도 유지한다. TypeScript 고정 결정은 변경하지 않았다. 루트 테스트의 기본 HTTP adapter도 API와 같은 버전으로 명시하고 peer 해석을 정리해 Nest core가 중복 로드되지 않게 했다.

- 앱 Dockerfile 3개는 `npm install -g pnpm`으로 bootstrap 버전만 고정하지 않는다. 프로젝트 `packageManager` 및 lockfile에는 12.4.1이 고정돼 있고 pnpm 12의 기본 `pmOnFail=download`가 선언 버전을 실행한다. 따라서 '앱 설치가 무조건 최신 pnpm으로 된다'고 단정하면 틀리다. 다만 bootstrap까지 Dev Container와 같은 버전으로 맞추면 설명과 설치 경로가 단순해진다. https://pnpm.io/settings/cli#pmonfail
- `tools/compose.yml:4`의 lychee만 `latest`다. 새 버전이 cache 상황에 따라 달라져 문서 검사 결과가 바뀔 수 있다. 기존 이미지 고정 방식을 적용하는 정도면 충분하며 자체 도구 이미지를 만들 이유는 없다.
- `libs/common/vitest.global.cjs:6`은 Mongo image digest를 제거한다. 설치된 Testcontainers 12.1.0이 image tag를 semver 비교하다 실패하면 구형 mongo shell을 고르는 소스를 확인했다. 이는 주석에 근거가 있는 호환 우회지만, digest 고정에 대한 예외다. upstream 지원 여부를 확인해 없앨 후보이며 대체 Mongo container framework를 새로 만들 필요는 없다. 현재 최신 Testcontainers도 12.1.0이다.
- pnpm root/workspace manifest에 버전이 여러 번 등장하지만 peer 계약과 소비자 설치 때문에 필요한 부분이 있다. 모두 루트로 옮기면 독립 workspace 계약이 흐려진다. catalog는 선택 가능한 관리 방식일 뿐 현재 시드의 필수 작업은 아니다.
- API의 TSC watch, Rspack production, Vitest compiler 변환은 실행 목적이 다르다. 세 경로가 있다는 이유로 무작정 통합하지 않는다. TypeScript decorator metadata 보존과 bundle 검증이라는 근거가 실제 config에 있다. AST 변환의 coverage 제외는 생성된 metadata fallback만 대상으로 하며 운영 분기를 임의 제외하는 설정으로 보지 않았다.

2026-09-18 공식 npm registry에서 직접 확인했다. 고정된 직접 의존성 64종 모두 존재하며 deprecated 표시는 없고 Node 26.8.2에 맞지 않는 engines도 없었다. manifest와 이전 registry 조사 목록도 다시 대조했다. 아래는 주요 갱신 후보다. 새 버전이 있다는 사실과 당장 올려야 한다는 판단은 다르며, 업그레이드·설치는 실행하지 않았다.

| 대상                              | 현재                 | 확인된 최신/같은 계열 | 판단                                                     |
| --------------------------------- | -------------------- | --------------------- | -------------------------------------------------------- |
| Node                              | 26.8.2               | 26.9.0                | 같은 26 계열 갱신 후보; Dev Container와 앱 이미지 함께   |
| pnpm                              | 12.4.1               | 12.4.2                | 작은 갱신 후보; packageManager·bootstrap 함께            |
| Nest common/core/platform/testing | 12.0.1               | 12.0.3                | 정기 patch 갱신 후보                                     |
| Vitest/coverage-v8                | 5.0.0                | 5.0.1                 | 함께 갱신하는 후보                                       |
| Zod                               | 4.6.2                | 4.6.5                 | patch 후보                                               |
| Restate SDK/client                | 1.17.0               | 1.17.1                | 함께 갱신하는 후보                                       |
| AWS SDK 3종                       | 3.1131.0             | 3.1135.0              | 함께 갱신하는 후보                                       |
| MongoDB server                    | 8.0.30               | 8.0.32 문서 확인      | 8.0 계열 patch 후보; 이미지 digest는 미검증              |
| Redis server                      | 8.2.9                | 8.2.10                | 같은 계열 patch 후보; 최신 8.10.2로 무조건 변경하지 않음 |
| NATS server                       | 2.14.6               | 2.14.7                | 같은 계열 patch 후보; 최신 2.15.0은 별도 검토            |
| Restate server                    | 1.7.9                | 1.7.10                | patch 후보                                               |
| TypeScript                        | 앱 6.0.3 / E2E 7.0.2 | 7.0.2                 | 사용처별 명시된 고정 결정 유지; 자동 일괄 갱신 제외      |

공식 근거: [npm registry](https://registry.npmjs.org/)의 package metadata, [Node](https://github.com/nodejs/node/releases/tag/v26.9.0), [MongoDB](https://www.mongodb.com/docs/manual/release-notes/8.0-changelog/), [Redis](https://github.com/redis/redis/releases/tag/8.2.10), [NATS](https://github.com/nats-io/nats-server/releases/tag/v2.14.7), [Restate](https://github.com/restatedev/restate/releases/tag/v1.7.10). Playwright 1.63.0·VersityGW 1.8.0·k6 2.2.0·checkout 7.0.1·devcontainers/ci 0.3.1900000450은 확인 당시 최신이었다. 전체 라이브러리가 낡았다고 볼 근거는 없다.

## 유지할 의도와 적절한 배치

- Dev Container 단일 경로, 시작/reset의 데이터 삭제, Mongo Replica Set·Redis Cluster, API 네 복제본, 100% coverage, 정기 반복 CI는 이미 선택한 학습·검증 범위다. 양이 많다는 이유로 낮추지 않는다.
- infra 서비스별 Compose 분리는 이미지·setup 책임이 뚜렷하다. 테스트 API/web/tools Compose도 실행 수명과 대상이 달라 한 파일로 통합하면 오히려 역할이 흐려진다.
- 앱 런타임과 독립 스크립트 SDK 경계를 유지한다. admin-create의 bcrypt/Mongo 직접 사용, test setup/teardown의 SDK 사용을 common으로 옮기지 않는다.
- API scripts 다섯 개의 책임은 명확하다. admin 생성/개발 Restate 등록/테스트 연결 및 자원 배선이다. 이 정도를 이유로 scripts 하위 디렉터리를 더 쪼갤 필요는 없다.
- api-docs는 9개 spec으로 주요 사용 흐름을 실행한다. 현재 TEST의 핵심 assertion은 HTTP status이고 응답은 로그에 남긴다. DTO shape·모든 업무 보장까지 각각 여기서 다시 assertion하도록 확대할 필요는 없다. '최초 응답 반환' 같은 설명이 이 harness 하나만으로 엄밀히 증명된다고 쓰지 않으면 된다.
- standalone admin의 password 숨김, cleanup의 finally, 인프라 readiness 확인은 작은 명확한 책임이며 삭제 대상이 아니다.
- Node용 공통 tsconfig와 Next/browser용 tsconfig 분리는 타당하다. Next 자동 수정 파일의 formatting 제외를 타입/lint 게이트 폐기로 해석하지 않는다.
- CI의 실패 진단은 race 원인을 보는 기록이다. API 필수 CI에 race 전체를 매번 새로 넣거나 진단 플랫폼을 더 만드는 것은 별도 요구가 없는 한 제안하지 않는다.

## 검증의 한계

실행기·설정·API-docs·관련 근거 소스를 직접 읽었다. pnpm lockfile은 두 YAML document를 파싱해 bootstrap pin과 11 importer의 직접 의존성 121개가 manifest와 일치함을 확인했다. 962개 간접 package/snapshot의 소스·공급망은 검토하지 않았다. API-docs PNG는 170550 bytes 및 SHA-256이 .env와 일치했다. 이 설정 검토 자체에서는 Docker 이미지 digest 재검증·별도 빌드·실제 장애 주입을 하지 않았다. 이번 소스 검토를 그 검증의 대체로 표시하면 안 된다.
