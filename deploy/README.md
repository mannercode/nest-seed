# 앱 배포

Docker Compose로 앱을 여러 컨테이너에 나누어 배포합니다. Node.js는 싱글 스레드로 동작하므로 API 컨테이너를 여러 개 띄우고, Nginx 로드밸런서로 요청을 나눕니다. 이렇게 여러 CPU 코어를 활용합니다.

MongoDB, Redis 같은 인프라는 이미 떠 있다고 가정합니다.

## 구성

| 파일          | 설명                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `compose.yml` | API 컨테이너 N개 + nginx 로드밸런서                                           |
| `nginx.conf`  | `least_conn` 방식 리버스 프록시, upstream 정보 access log                     |
| `test.sh`     | compose up → [../apps/api/api-docs/run.sh](../apps/api/api-docs/) 실행 → down |

인프라 설정 외에 함께 볼 만한 리소스는 다음과 같습니다.

- [../apps/api/api-docs/](../apps/api/api-docs/) — curl 기반 실행 가능한 API 문서. `test.sh`가 호출합니다.
- [../apps/api/tests/](../apps/api/tests/) — API 컨테이너 4개로 돌리는 분산 레이스 시나리오. [testing.md](../docs/testing.md#5-분산-테스트-cross-replica-race)에서 자세히 설명합니다.

## 주요 설정

| 변수       | 기본값 | 설명              |
| ---------- | ------ | ----------------- |
| `REPLICAS` | 4      | API 컨테이너 개수 |

인프라 연결은 `nest-seed-infra` docker 네트워크에 join 한 뒤, service name(`mongo1`, `redis1`, `nats`, `temporal`, `minio` 등)으로 직접 접근합니다.

## `x-replica-id` 응답 헤더

[bootstrap.ts](../apps/api/src/bootstrap.ts)의 미들웨어는 모든 HTTP 응답에 `x-replica-id: <os.hostname()>`를 넣습니다. 컨테이너 hostname이 각 API 컨테이너의 고유 ID 역할을 하므로, 클라이언트 쪽에서도 nginx가 실제로 여러 컨테이너로 요청을 나누었는지 확인할 수 있습니다. 분산 테스트도 이 헤더로 여러 컨테이너를 거쳤는지 검증합니다.
