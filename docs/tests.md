# tests/ — 실행 스택 밖에서 하는 검증

API와 라이브러리의 기본 동작은 각 workspace의 통합 테스트에서 검증한다. `tests/`에서는 여러 API 프로세스 사이의 경쟁, 브라우저와 production build의 연결, 같은 조건에서의 성능 차이를 확인한다. 데모 화면별 단위 테스트나 API 통합 테스트의 모든 실패 조건을 이곳에 다시 작성하지 않는다. 명령과 결과 위치는 [README의 실행 안내](../README.md#실행과-검증)에 있다.

## API 스택과 수명

[API Compose](../tests/api/compose.yml)는 API 문서·race·benchmark가 사용하는 API 복제본 4개와 NGINX를 띄우고 기존 개발 인프라에 연결한다. 프로세스를 나눠 실행해야 동시 요청을 처리할 때 로컬 메모리에만 의존하는지, Redis·DB·NATS를 통해 다른 프로세스와 협력하는지 구분할 수 있다.

```text
HTTP/SSE client → NGINX → API 복제본 4개 → 개발 인프라
Restate         → NGINX의 HTTP/2 endpoint → API 복제본 4개
```

이 스택은 운영 배포 예제가 아니다. TLS·secret 관리·백업/복구·관측 시스템·프론트엔드 배포·무중단 revision 전환은 제공하지 않는다.

환경 변수는 [개발 환경의 주입 방식](devcontainer.md#1-환경-변수는-재생성해야-반영된다)을 따른다. 실행기는 Dev Container에 설정된 고정 개발 관리자 계정으로 로그인하므로, infra reset이 생성한 계정이 준비되어 있어야 한다. 스택을 종료하면 API·NGINX만 정리한다. DB·bucket·journal은 별도 [infra reset](infra.md)으로 초기화하며, benchmark가 만든 데이터도 스택 종료 후 남는다.

API 문서·benchmark·web 실행기는 검증 명령이 실패하면 그 종료 코드를 반환한다. 검증이 성공해도 스택 정리에 실패하면 실행 전체를 실패로 처리한다.

API 문서는 상영 workflow가 성공한 뒤 상영·티켓을 한 번 조회한다. workflow 성공은 같은 트랜잭션에서 저장을 마쳤다는 뜻이므로, 조회 결과가 없거나 부족하면 다시 기다리지 않고 테스트를 실패시킨다.

API 컨테이너가 종료된 사실을 자동 재시작으로 가리지 않도록 restart 정책을 두지 않는다. chaos 시나리오에서도 kill·start로 복제본을 직접 제어한다.

## Race의 관측 범위

race는 HTTP/SSE 요청으로 결과를 확인하며 API 내부 클래스를 직접 호출하지 않는다. 구매·상영의 보상과 재시도 동작은 API 통합 테스트에서 함께 확인한다.

| 시나리오                | 직접 확인하는 결과                                                                |
| ----------------------- | --------------------------------------------------------------------------------- |
| `user-signup-race`      | 동일 이메일의 동시 가입은 성공 하나와 충돌 응답으로 끝남                          |
| `ticket-holding-race`   | 동일 좌석 묶음의 동시 선점은 사용자 하나만 성공함                                 |
| `showtime-overlap-race` | 겹치는 상영 생성 요청의 종결 이벤트에서 성공 하나와 업무상 충돌을 관측함          |
| `purchase-double-spend` | 동일 묶음의 구매는 하나만 성공하며 그 구매를 이력에서 다시 읽을 수 있음           |
| `purchase-overlap-race` | `[A, B]`와 `[B, C]` 구매 중 하나만 성공하고 승자의 티켓만 판매 상태로 남음        |
| `sse-fanout-race`       | 여러 복제본에 연결된 SSE 클라이언트가 접수한 모든 saga의 완료 이벤트를 받음       |
| `jwt-refresh-race`      | 같은 refresh token의 동시 회전에서 하나만 성공하며 새 토큰으로 세션을 계속 사용함 |
| `replica-chaos`         | 가입 트래픽 중 복제본을 kill·start하고 오류율 및 복구 후 응답 복제본을 확인함     |

구매 overlap은 승자의 원 요청과 성공 응답·구매 이력의 티켓 목록·최종 판매 상태를 대조한다. 패자는 결제 전 선점 claim 단계에서도 거절될 수 있어, 이 시나리오만으로 결제 취소를 검증할 수는 없다. 결제 후 실패와 보상은 API의 구매 통합 테스트에서 검증한다.

`x-replica-id`는 응답한 API의 hostname이며, 문자열 형식은 고정된 API 계약이 아니다. HTTP 클라이언트는 keep-alive로 특정 복제본에 요청이 고정되지 않도록 한다. 가입·선점·구매·refresh 시나리오는 한 회차 전체에서 2개 이상 복제본의 응답을 확인하지만, 같은 이메일이나 좌석을 두고 경쟁하는 요청들이 여러 복제본에 분산됐는지는 따로 확인하지 않는다.

```text
같은 반복에서 api-1, api-2 관측  → 스택에 요청이 분산됨
같은 좌석 경쟁에서 api-1, api-2 관측 → 그 경쟁의 프로세스 간 분산을 확인함
```

SSE 시나리오는 여러 복제본에 구독이 연결됐는지와 각 구독에 이벤트가 전달됐는지 확인한다. 상영 overlap은 복제본 4개로 실행하지만 요청별 복제본 헤더를 따로 검사하지 않는다.

`replica-chaos`는 복제본 장애 중에도 가입 요청을 처리하는지 확인한다. 업무 단계의 재시도는 API 통합 테스트가, Restate 서버 재시작 후 실행 재개는 [journal 복구 테스트](../infra/tests/restate-journal-recovery.js)가 확인한다.

race가 실패하면 실행기가 스택을 정리하기 전에 컨테이너 로그·상태·자원 사용량과 MongoDB 복제 상태를 수집한다.

저장 완료를 기다리는 동안 바깥 요청이 먼저 끊기지 않도록, HTTP 클라이언트와 프록시의 대기 기한을 DB·workflow의 저장 확인 기한보다 길게 둔다.

인증이 필요한 장시간 race는 매 회차의 동시 요청을 시작하기 전에 관리자 로그인과 참여 사용자의 토큰 갱신을 마친다. 동시 요청 중 인증이 실패하면 테스트도 실패한다. 가입·refresh 자체를 검증하는 시나리오에는 별도 관리자 갱신을 붙이지 않는다.

## Restate 등록과 포트

HTTP `/health`가 성공해도 Restate의 workflow 등록은 따로 필요하다. 실행기는 API와 NGINX가 healthy 상태가 된 후 `restate-register`를 실행한다. 개별 복제본 주소 대신 고정된 `http://nginx:9080`을 등록해 workflow 실행 요청을 API 복제본에 전달한다.

API의 HTTP 포트나 Restate 내부 포트를 바꾸면 환경 변수뿐 아니라 [NGINX upstream](../tests/api/nginx.conf)과 Compose의 등록 URI도 함께 맞춘다.

등록에는 `force: false`를 사용하므로 같은 URI의 코드·manifest만 바꿔서는 기존 배포 정의가 교체되지 않는다. 보존할 작업이 없는 개발 환경에서는 infra reset으로 초기화할 수 있지만, journal도 삭제되므로 운영 revision 전환에는 사용하지 않는다. 진행 중인 작업을 보존하는 배포 조건은 [설계 결정](reference/decisions.md)에서 설명한다.

## 브라우저 E2E와 데모

web 테스트는 production build한 console·user-app과 API를 Compose로 실행하고, Dev Container의 Playwright·Chromium으로 접속한다. 브라우저는 Dev Container 준비 과정에서 workspace lockfile의 버전에 맞춰 설치한다. 일반 E2E는 호스트에 포트를 공개하지 않고 Docker 서비스 이름으로 접속한다.

console의 로그인·영화/극장/사용자 관리와 user-app의 가입·로그인·홈 조회, 쿠키 전달·갱신·로그아웃을 검증한다. 예매·구매 전체 UI는 검증 대상이 아니다. API 통합 테스트와 같은 행동을 검사하더라도 브라우저 테스트에서는 실제 화면·BFF·쿠키가 API와 함께 동작하는지 확인한다.

web Compose는 내부 HTTP를 사용하므로 쿠키의 Secure 속성을 끈다. 테스트가 신뢰할 수 있는 프록시 역할을 하도록 전달 헤더 신뢰 설정도 켠다. 이 설정을 운영 기본값으로 복사하지 않는다. 테스트에서 IP 헤더를 전달하는 것만으로는 실제 공개 프록시의 헤더 재구성이나 원본 서버(origin)로의 직접 접근 차단을 검증할 수 없다. 운영에 적용할 조건은 [apps 가이드](apps.md)에 있다.

web 실행기는 `${COMPOSE_PROJECT_NAME}-web` 프로젝트의 앱만 종료한다.

## Benchmark와 반복 CI

benchmark는 같은 머신·이미지·데이터 조건에서 이전 실행과 성능을 비교한다. 극장 읽기·쓰기와 혼합 부하, gzip 사용 여부를 비교하며 절대 성능이나 운영 SLA를 보장하지 않는다. 먼저 정상 상태 코드만 나왔는지 확인한 뒤 처리량과 지연 시간의 p95·p99를 비교한다.

데이터를 준비하는 seed 회차와 본 측정을 시작하기 전에 다시 로그인하고, 장시간 실행 중에는 각 가상 사용자(VU)가 토큰 만료 전에 갱신한다. 인증이 실패하면 실행 전체를 실패로 끝낸다. 인증 요청은 극장 요청의 지연 시간·개수 지표에서 제외하지만 서버 자원은 함께 사용하므로, 성능을 비교할 때 인증 조건도 같게 맞춘다.

필수 AtoZ는 기본 회귀 검사를 실행한다. Stability와 API Race CI는 간헐적인 실패를 찾으려고 별도로 반복 실행한다. Stability는 반복할 때 커버리지를 수집하지 않으며, AtoZ의 100% 커버리지 기준을 대신하지 않는다. 반복 횟수와 일정은 [CI 파일](../.github/workflows/)에서 정한다.
