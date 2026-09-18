# nest-seed

NestJS 프로젝트를 시작할 때 가져다 쓰고 고칠 수 있는 시드다. `apps/api`가 본체이고 `libs/`는 다른 NestJS 프로젝트에도 사용할 공통 코드다. 영화 예매는 모듈 협력·데이터 정합성·외부 연동을 설명하는 예제이며, `console`과 `user-app`은 API에 연결하는 작은 Next.js 데모다.

단순 CRUD부터 시작해 필요한 경계를 차례로 읽는다.

| 읽을 코드                                                                       | 보여 주는 것                                    |
| ------------------------------------------------------------------------------- | ----------------------------------------------- |
| [theaters](../../apps/api/src/services/core/theaters/)                          | 서비스·저장소·DTO의 기본 구성                   |
| [booking](../../apps/api/src/services/application/booking/)                     | 여러 도메인의 공개 API를 조합하는 유스케이스    |
| [home](../../apps/api/src/services/view/user-app/home/)                         | 화면에 필요한 읽기 응답 조합                    |
| [showtime-creation](../../apps/api/src/services/application/showtime-creation/) | 비동기 접수, Restate 실행, DB transaction과 SSE |
| [purchase](../../apps/api/src/services/application/purchase/)                   | 한 상영의 티켓 구매, 멱등성·보상·완료 알림      |

각 코드와 같은 이름의 [API 통합 테스트](../../apps/api/src/__tests__/)를 함께 읽으면 입력·응답과 저장 결과의 계약을 확인할 수 있다. 실제 PG, 여러 상영관을 갖는 극장 모델, 예매 전체 UI는 구현하지 않는다.

## 시작하기

공식 개발 경로는 Dev Container다. Docker가 있는 호스트의 저장소를 VS Code Remote SSH로 열고 Dev Containers 확장을 사용한다. 호스트와 컨테이너의 workspace 절대경로는 같아야 한다. 이유는 [개발 환경](devcontainer.md)에 있다.

1. VS Code에서 `Reopen in Container`를 실행한다. 시작할 때 개발 인프라를 초기화하고 의존성을 준비한다.
2. 컨테이너 터미널에서 `pnpm run test`를 실행한다.
3. `pnpm run dev`를 실행하고 `curl http://localhost:3000/health`로 API를 확인한다.
4. VS Code의 포트 패널에서 console의 `3100`, user-app의 `3200`을 전달한다. 자동 포트 전달은 꺼져 있다.
5. console은 개발 admin(`admin@nest-seed.local` / `DevPass1!`)으로 로그인한다. user-app에서는 가입·로그인과 홈 화면을 확인한다.

Dev Container 시작, `bash infra/reset.sh`, `pnpm run atoz`는 개발 데이터를 지운다. DB·S3 파일·Restate journal·JetStream 이벤트를 보존할 환경에서 실행하지 않는다. 초기화 뒤 개발 admin도 다시 만들어진다.

루트 `.env.api`와 `.env.infra`는 커밋된 개발·검증 값이다. 수정한 값은 Dev Container를 재생성해야 반영된다. 운영 secret은 저장소 밖에서 주입한다. env 파일의 역할과 실제 주입 경로는 [개발 환경](devcontainer.md)이 설명한다.

## 실행과 검증

아래 명령은 저장소 루트에서 실행한다.

| 명령                | 용도                                                           |
| ------------------- | -------------------------------------------------------------- |
| `pnpm run dev`      | API와 두 데모를 watch mode로 실행                              |
| `pnpm run test`     | workspace의 단위·통합 테스트                                   |
| `pnpm run lint`     | 타입·코드·format·shell·문서 링크 검사                          |
| `pnpm run atoz`     | 인프라 초기화부터 build·테스트·브라우저·API 문서까지 전체 회귀 |
| `pnpm run api-docs` | 복제본 4개의 API 스택에서 실행 가능한 문서 검증                |

race와 benchmark는 별도 실행한다. 부분 검사와 결과 위치는 [테스트 실행 안내](reference/test-execution.md)를 따른다. 커버리지 100%와 반복 CI는 검증되지 않은 경로와 간헐 실패를 드러내는 개발 제약이며, 모든 버그가 없다는 보장은 아니다.

API 사용 예시는 [api-docs](../../apps/api/api-docs/)의 bash·curl spec이 소유한다. 실행 중인 개발 API를 대상으로 한 문서만 실행할 수도 있다.

```bash
bash apps/api/api-docs/run.sh showtime-creation.spec
```

spec에 요청이 있고, 실행 결과에는 실제 응답이 기록된다. 주요 성공·실패 흐름을 실행하는 문서이므로 전체 라우트 카탈로그나 통합 테스트의 모든 단언을 대신하지 않는다.

## 구조와 선택

API는 Gateway → View → Application → Core → Infrastructure 방향의 SoLA 경계를 사용한다. 필요한 하위 계층은 직접 호출할 수 있으며, 같은 계층의 다른 모듈을 조합할 때는 상위 유스케이스가 협력을 맡는다. 단일 Core의 CRUD에 Application 계층을 추가하지 않는다.

MongoDB는 주 데이터와 transaction, Redis는 선점·리프레시 세션, NATS는 실시간 전달, JetStream은 보존할 메시지, Restate는 중단 후 실행 재개를 맡는다. SDK 연결과 실행은 common이, 업무 쿼리·정책·workflow 단계는 API가 소유한다. 선택 이유와 한계는 [설계 결정](reference/decisions.md)에 있다.

| 위치             | 안내                                                |
| ---------------- | --------------------------------------------------- |
| `apps/`          | [모듈 경계, 업무 흐름, 인증과 DTO](apps.md)         |
| `libs/`          | [공통화 기준과 공개 계약](libs.md)                  |
| `tests/`         | [다중 프로세스·브라우저·성능 검증의 범위](tests.md) |
| `infra/`         | [개발 topology와 reset의 범위](infra.md)            |
| `tools/`         | [개발·테스트 실행 도구](tools.md)                   |
| `.devcontainer/` | [개발 환경과 env 주입](devcontainer.md)             |

공통 작성 규칙은 [네이밍·타입·오류·테스트 규칙](reference/conventions.md)에 둔다. [과거 가이드 원문](../backup/README.md)은 현재 구현 지침으로 사용하지 않고, 할 일과 미결 검토는 루트 [_todo](../../_todo/README.md)에서 관리한다.

포크할 때 프로젝트 식별자와 작성자 URL을 일괄 치환하지 않는다. 패키지 scope를 바꾸면 manifest·의존성·import·별칭·lockfile을 함께 맞춘다. 개발용 스택을 운영에 적용하려면 [BFF 신뢰 경계](apps.md#데모와-bff)와 [Restate revision 전환](reference/decisions.md#restate와-외부-효과)의 조건을 검토한다. TLS·backup·운영 관측·무중단 배포는 이 시드의 제공 범위에 없다.
