# Mono App Deployment

Docker Compose로 mono 앱을 멀티 컨테이너로 배포한다.
Node.js는 싱글 스레드이므로 컨테이너 N개 복제 + Nginx 로드밸런서 구성으로 멀티 코어를 활용한다.

MongoDB, Redis 등 인프라는 이미 존재한다고 전제한다.

## 구성

| 파일               | 설명                                |
| ------------------ | ----------------------------------- |
| `compose.yml`      | app x N replicas + nginx 로드밸런서 |
| `nginx.conf`       | least_conn 방식 리버스 프록시       |
| `test-e2e.sh`      | e2e 테스트 (1회 호출)               |
| `test-stress.sh`   | 스트레스 테스트 (동시 다발 반복)    |

## 주요 설정

| 변수          | 기본값 | 설명               |
| ------------- | ------ | ------------------ |
| `REPLICAS`    | 4      | 앱 컨테이너 수     |
| `CLIENTS`     | 20     | 동시 클라이언트 수 |
| `ROUNDS`      | 10     | 반복 횟수          |

인프라 연결은 `host.docker.internal`을 통해 호스트 머신의 기존 서비스에 접근한다.
