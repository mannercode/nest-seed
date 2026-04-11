# Mono App Deployment

Docker Compose로 mono 앱을 멀티 컨테이너로 배포한다.
Node.js는 싱글 스레드이므로 컨테이너 N개 복제 + Nginx 로드밸런서 구성으로 멀티 코어를 활용한다.

MongoDB, Redis 등 인프라는 이미 존재한다고 전제한다.

## 사용법

```bash
cp .env.example .env   # 환경변수 편집
./deploy.sh            # 운영 배포
./test-stress.sh       # 스트레스 테스트 (완료 후 자동 정리)
```

## 구성

| 파일               | 설명                                |
| ------------------ | ----------------------------------- |
| `compose.yml`      | app x N replicas + nginx 로드밸런서 |
| `compose.e2e.yml`  | 단일 app + api-setup (e2e 테스트용) |
| `nginx.conf`       | least_conn 방식 리버스 프록시       |
| `deploy.sh`        | 운영 배포                           |
| `test-e2e.sh`      | e2e 테스트 (단일 app, 1회 호출)     |
| `test-stress.sh`   | 스트레스 테스트 (N replicas + nginx) |
| `.env.example`     | 환경변수 템플릿                     |

## 주요 설정

| 변수          | 기본값 | 설명                         |
| ------------- | ------ | ---------------------------- |
| `REPLICAS`    | 4      | 앱 컨테이너 수               |
| `LISTEN_PORT` | 3000   | 외부 노출 포트               |
| `CLIENTS`     | 10     | 동시 클라이언트 수 (test.sh) |
| `ROUNDS`      | 3      | 반복 횟수 (test.sh)          |

인프라 연결은 `host.docker.internal`을 통해 호스트 머신의 기존 서비스에 접근한다.
