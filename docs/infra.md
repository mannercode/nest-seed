# infra/ — 개발 인프라

개발 환경은 MongoDB Replica Set, Redis Cluster, S3 호환 스토리지, NATS/JetStream, Restate를 함께 띄운다. 단순한 로컬 대체재로 줄이지 않은 이유는 트랜잭션·Redis hash slot·프로세스 간 메시지처럼 토폴로지에서만 드러나는 문제를 개발 단계에서 발견하기 위해서다.

이 인프라는 dev server, API 통합 테스트, 다중 복제본 검증 스택이 공유한다. 접속 값은 `.env.infra`, 서비스 구성은 Compose 파일이 각각 소유한다.

`bash infra/reset.sh`는 개발 인프라를 다시 만드는 복구 수단이지만 volume도 지운다. 따라서 Restate journal과 JetStream의 미처리 이벤트도 삭제된다. 보존해야 할 실행이 없는 개발·검증 환경에서만 사용한다.

개발용 NATS와 Restate는 단일 서버다. API 복제본 사이의 동작은 검증하지만 broker·workflow runtime 자체의 HA를 보장하지는 않는다. 운영은 별도의 클러스터링과 복구 정책이 필요하다.
