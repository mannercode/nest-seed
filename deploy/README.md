# 앱 배포

Docker Compose로 API 컨테이너를 여러 개 띄우고 NGINX로 요청을 나눈다. Node.js는 기본적으로 한 프로세스가 한 이벤트 루프를 쓰기 때문에, 컨테이너를 나누어 여러 CPU 코어를 활용한다.

MongoDB, Redis, MinIO, NATS, Temporal 같은 인프라는 이미 실행 중이라고 가정한다.

## 구성

| 파일          | 설명                                                                                |
| ------------- | ----------------------------------------------------------------------------------- |
| `compose.yml` | API 컨테이너 N개 + NGINX 로드밸런서                                                 |
| `nginx.conf`  | `least_conn` 방식 리버스 프록시, upstream 정보 액세스 로그                          |
| `test.sh`     | compose up → [../apps/api/api-docs/run.sh](../apps/api/api-docs/run.sh) 실행 → down |

인프라 설정 외에 함께 볼 만한 리소스는 다음과 같다.

- [../apps/api/api-docs/](../apps/api/api-docs/) — curl 기반 실행 가능한 API 문서. `test.sh`가 호출한다.
- [../tests/api-race/](../tests/api-race/) — API 컨테이너 4개로 실행하는 분산 레이스 시나리오. [testing.md](../docs/testing.md#6-분산-테스트-복제본-간-레이스)에서 자세히 설명한다.

## 주요 설정

| 변수                   | 기본값                                | 설명                                            |
| ---------------------- | ------------------------------------- | ----------------------------------------------- |
| `COMPOSE_PROJECT_NAME` | 필수 (devcontainer: workspace 폴더명) | API와 개발 인프라가 공유할 Docker 네트워크 이름 |
| `LISTEN_PORT`          | 3000                                  | 호스트에 노출할 NGINX 포트                      |
| `REPLICAS`             | 4                                     | API 컨테이너 개수                               |

인프라 연결은 `${COMPOSE_PROJECT_NAME}` Docker 네트워크에 붙은 뒤, 서비스 이름(`mongo1`, `redis1`, `nats`, `temporal`, `minio` 등)으로 접근한다. devcontainer에서는 이 값이 workspace 폴더명으로 설정되어 `.devcontainer/infra` compose와 `deploy/compose.yml`이 같은 네트워크를 공유한다.

인프라 접속 값은 `apps/api/.env`와 `.devcontainer/infra/.env`를 함께 본다. `deploy/compose.yml`은 `apps/api/.env`를 읽고, 실제 인프라 컨테이너 이름과 포트는 `.devcontainer/infra/.env`와 compose 파일들이 정한다.

`test.sh`는 Dev Container 환경 변수인 `WORKSPACE_ROOT`를 사용한다. 배포 검증도 Dev Container 안에서 실행하는 것을 기준으로 한다.

## `x-replica-id` 응답 헤더

[bootstrap.ts](../apps/api/src/bootstrap.ts)의 미들웨어는 모든 HTTP 응답에 `x-replica-id: <os.hostname()>`를 넣는다. 컨테이너 hostname이 API 컨테이너의 고유 ID 역할을 한다. 클라이언트와 분산 테스트는 이 헤더로 NGINX가 실제로 여러 컨테이너에 요청을 나누었는지 확인한다.
