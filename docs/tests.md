# tests/ — 실행 스택 밖에서 하는 검증

API와 라이브러리의 동작은 각 workspace의 통합 테스트가 먼저 검증한다. `tests/`는 여러 API 프로세스 사이의 경쟁, 브라우저와 production build의 연결, 같은 조건의 성능 비교를 담당한다. 데모 화면마다 unit suite를 만들거나 API 통합 테스트의 모든 실패 조건을 다시 복제하는 위치가 아니다. 명령과 결과 위치는 [README의 실행 안내](../README.md#실행과-검증)에 있다.

## API 스택과 수명

[API Compose](../tests/api/compose.yml)는 API 문서·race·benchmark가 공유하는 복제본 4개와 NGINX를 띄우고 기존 개발 인프라에 연결한다. 프로세스가 나뉘어야 로컬 메모리만으로 경쟁을 처리한 구현과 Redis·DB·NATS의 경계를 사용하는 구현을 구분할 수 있다. 복제본 수는 이 검증을 위한 선택이다.

```text
HTTP/SSE client → NGINX → API 복제본 4개 → 개발 인프라
Restate         → NGINX의 HTTP/2 endpoint → API 복제본 4개
```

이 스택은 운영 배포 예제가 아니다. TLS, secret 관리, backup/restore, 관측 backend, frontend 배포와 무중단 revision 전환은 제공하지 않는다.

Compose는 커밋된 개발 env 두 파일을 raw 형식으로 API에 주입한다. 실행기는 Dev Container에 주입된 고정 개발 admin으로 로그인하며 준비되지 않은 계정을 임의로 대체하지 않는다. 스택 종료는 API·NGINX의 정리이며, DB·bucket·journal 초기화는 별도 [infra reset](infra.md)이다. benchmark가 만든 데이터도 스택 종료로 사라지지 않는다.

API 문서·benchmark·web 실행기는 본 검증의 실패 코드를 보존한다. 검증이 성공해도 스택 정리에 실패하면 실행 전체를 실패로 처리한다.

API 문서는 상영 workflow의 성공까지 기다린 후 상영·티켓을 한 번 조회한다. 성공은 같은 트랜잭션의 저장 완료를 뜻하므로, 결과가 없거나 부족하면 추가 polling으로 넘기지 않고 실패시킨다.

API 컨테이너는 자동 재시작하지 않는다. 종료가 restart 정책에 가려지지 않아야 하며, chaos가 kill·start를 직접 제어한다.

## Race의 관측 범위

race는 내부 클래스를 호출하지 않고 HTTP/SSE로 결과를 관측한다. 구매·상영의 보상 및 재시도는 API 통합 테스트도 함께 읽어야 한다.

| 시나리오                | 직접 확인하는 결과                                                                |
| ----------------------- | --------------------------------------------------------------------------------- |
| `user-signup-race`      | 동일 이메일의 동시 가입은 성공 하나와 충돌 응답으로 끝남                          |
| `ticket-holding-race`   | 동일 좌석 묶음의 동시 선점은 사용자 하나만 성공함                                 |
| `showtime-overlap-race` | 겹치는 상영 생성 요청의 종결 이벤트에서 성공 하나와 업무상 충돌을 관측함          |
| `purchase-double-spend` | 동일 묶음의 구매는 하나만 성공하며 그 구매를 이력에서 다시 읽을 수 있음           |
| `purchase-overlap-race` | `[A, B]`와 `[B, C]` 구매 중 하나만 성공하고 승자의 티켓만 판매 상태로 남음        |
| `sse-fanout-race`       | 여러 복제본에 연결된 SSE client가 접수한 모든 saga의 완료 이벤트를 받음           |
| `jwt-refresh-race`      | 같은 refresh token의 동시 회전에서 하나만 성공하며 새 토큰으로 세션을 계속 사용함 |
| `replica-chaos`         | 가입 트래픽 중 복제본을 kill·start하고 오류율 및 복구 후 응답 복제본을 확인함     |

구매 overlap은 같은 묶음의 중복 요청만으로 드러나지 않는 부분 중복을 검증한다. 패자는 결제 전 선점 claim에서도 거절될 수 있으므로 이 시나리오의 성공만으로 결제 취소를 검증했다고 해석하지 않는다. 결제 후 실패와 보상은 API의 구매 통합 테스트가 다룬다.

`x-replica-id`는 응답한 API의 hostname이다. 문자열 형식은 API 계약이 아니다. HTTP client는 keep-alive 연결에 요청이 고정되지 않도록 하고, 가입·선점·구매·refresh 시나리오는 한 반복 전체에서 2개 이상 복제본 응답을 확인한다. 각 충돌 키가 여러 복제본에 분산되었다는 뜻은 아니다.

```text
같은 반복에서 api-1, api-2 관측  → 스택에 요청이 분산됨
같은 좌석 경쟁에서 api-1, api-2 관측 → 그 경쟁의 프로세스 간 분산을 확인함
```

SSE는 구독한 복제본들의 분산과 이벤트 전달을 확인한다. 상영 overlap은 4개 복제본 스택에서 실행하되 요청별 복제본 헤더를 별도로 단언하지 않는다. 이 차이를 무시하고 모든 테스트가 동일한 분산 보장을 검증한다고 쓰지 않는다.

`replica-chaos`의 가입 가용성, API 통합 테스트의 업무 단계 재시도, [Restate journal 복구](../infra/tests/restate-journal-recovery.js)는 서로 다른 검증이다. 각각이 다른 검증을 대신하거나 운영 장애 전체를 증명하지는 않는다.

실패하면 runner가 스택을 정리하기 전에 컨테이너 로그·상태·자원과 MongoDB 복제 상태를 수집한다. 먼저 같은 시각의 실패 응답과 로그를 본다. 기대하지 않은 오류를 정상 경쟁으로 분류하거나 timeout·반복 횟수를 바꿔 실패를 숨기지 않는다.

HTTP client와 proxy는 DB·workflow의 저장 확인 기한보다 오래 기다리도록 맞춘다. 내부 작업이 허용된 지연을 기다리는 동안 바깥 요청이 먼저 끊기지 않아야 한다.

인증을 사용하는 장시간 race는 매 회차의 경합 전에 관리자 로그인과 참여 사용자의 refresh를 끝낸다. 경합 중 발생한 인증 실패는 그대로 실패로 처리한다. 가입·refresh 자체를 검증하는 시나리오에는 별도 관리자 갱신을 붙이지 않는다.

## Restate 등록과 포트

HTTP `/health` 통과와 Restate의 workflow 등록은 별개다. runner는 API와 NGINX가 healthy가 된 후 `restate-register`를 실행한다. 개별 복제본 대신 안정적인 `http://nginx:9080`을 등록해 invocation을 API 복제본에 전달한다.

API의 HTTP 및 Restate 내부 포트를 바꾸면 [NGINX upstream](../tests/api/nginx.conf)과 Compose의 등록 URI도 함께 맞춘다. env 값만 바꿔도 NGINX 파일이 자동으로 갱신되는 구조는 아니다.

등록은 `force: false`다. 같은 URI 뒤의 코드·manifest를 바꾼 것만으로 기존 deployment 정의가 교체되지 않는다. 보존할 실행이 없는 개발 환경은 infra reset으로 초기화할 수 있지만, journal도 삭제하므로 운영 revision 전환에 사용하지 않는다. 배포 시 필요한 조건은 [설계 결정](reference/decisions.md)에서 다룬다.

## 브라우저 E2E와 데모

web 테스트는 production build의 console·user-app과 API를 Compose로 실행하고, Dev Container의 Playwright·Chromium이 접근한다. 브라우저 설치는 workspace lockfile 및 Dev Container 준비 과정이 소유한다. 일반 E2E에는 host port를 공개하지 않고 Docker service DNS를 사용한다.

검증 범위는 console의 로그인·영화/극장/사용자 관리와 user-app의 가입·로그인·홈 조회, 쿠키 전달·갱신·로그아웃이다. 예매·구매 전체 UI를 가정하지 않는다. 같은 행위를 API 내부와 브라우저에서 확인하더라도 후자는 BFF·cookie·실제 화면 연결이라는 다른 경계를 본다.

web Compose는 내부 HTTP를 사용하므로 cookie의 Secure를 끄고, 테스트가 신뢰 edge를 모사하도록 proxy header 신뢰를 켠다. 이 설정을 운영 기본값으로 복사하지 않는다. 테스트가 IP 헤더를 전달했다고 실제 public edge의 헤더 재구성이나 origin 접근 차단을 검증한 것은 아니다. 실제 신뢰 경계는 [apps 가이드](apps.md)가 설명한다.

web runner는 `${COMPOSE_PROJECT_NAME}-web`의 앱만 종료한다. 브라우저 실패의 trace·screenshot·HTML 보고서는 `_output/`에서 확인한다.

## Benchmark와 반복 CI

benchmark는 같은 머신·이미지·데이터 조건의 이전 실행과 비교한다. 극장 읽기·쓰기와 혼합 부하, gzip 유무를 비교하며 절대 성능이나 운영 SLA를 보장하지 않는다. 먼저 정상 상태 코드만 나왔는지 확인하고 처리량·p95·p99를 비교한다. 오류 응답의 짧은 지연 시간을 개선으로 해석하지 않는다.

seed 회차와 본 측정 시작 전에 다시 로그인하고, 장시간 실행 중에는 각 VU가 토큰 만료 전에 갱신한다. 인증 실패는 실행 전체를 실패로 끝낸다. 인증 요청은 극장 요청의 지연·개수 지표에 포함하지 않지만 서버 자원은 공유하므로 같은 인증 조건에서 성능을 비교한다. 401을 받은 업무 요청을 재시도하거나 액세스 TTL을 늘려 결과를 맞추지 않는다.

필수 AtoZ는 기본 회귀를 실행하고, Stability와 API Race CI는 간헐적인 실패를 찾기 위해 별도로 반복한다. Stability의 coverage 비활성 반복은 AtoZ의 100% 게이트를 대신하지 않는다. 횟수·스케줄은 [CI 파일](../.github/workflows/)이 소유한다. 단발 통과도 반복 통과도 모든 경쟁·장애가 사라졌다는 증명은 아니다.

러너 통신 두절로 검증 결과를 받지 못한 경우에는 새 러너에서 한 번만 재검증한다. [자동 재실행](../.github/workflows/retry-runner-disconnect.yaml)은 첫 실행의 미통과 작업이 모두 GitHub의 통신 두절 오류로 끝났을 때만 허용하며, 테스트·빌드 오류나 취소·기한 초과가 섞이면 재실행하지 않는다. 최초 실패 기록은 보존하고 재실행도 실패하면 그대로 남긴다.
