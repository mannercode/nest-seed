# infra/ — 개발 인프라

devcontainer가 부팅할 때 `postStartCommand`로 `bash infra/reset.sh`를 실행해 이 compose 묶음을 띄운다. 인프라가 꼬이면 언제든 같은 명령으로 초기화한다.

- `compose.mongo.yml` — MongoDB Replica Set. 트랜잭션이 Replica Set을 요구한다.
- `compose.redis.yml` — Redis Cluster. 스탠드얼론에서는 통과하지만 Cluster에서만 실패하는 코드가 개발 단계에서 드러나게 한다.
- `compose.minio.yml` — S3 호환 스토리지. presigned 업로드·다운로드의 대상이다.
- `compose.nats.yml` — 컨테이너 사이 pub/sub.
- `temporal/` — Temporal 서버 + PostgreSQL + 스키마·네임스페이스 준비 컨테이너.

이 인프라는 세 소비자가 공유한다. dev 서버(`npm run dev`)와 `apps/api` 통합 테스트가 직접 붙고, 검증용 4-replica 배포 스택(`deploy/`)도 같은 Docker 네트워크(`COMPOSE_PROJECT_NAME`)에 붙어 서비스 이름(`mongo1`, `redis1` 등)으로 접근한다. 접속 값의 정의처는 `.env.infra`다.

토폴로지를 운영과 같게 두는 이유는 [설계 결정 §5](reference/decisions.md#5-개발-환경-dev-container-단일-경로)가, 환경 변수가 여기서 앱까지 흐르는 전체 경로는 [환경 변수](reference/environment.md)가 설명한다. 각 설정값의 사유는 compose 파일의 현장 주석에 있다.
