# infra/ — 개발 인프라

devcontainer가 부팅할 때 `postStartCommand`로 `bash infra/reset.sh`를 실행해 이 compose 묶음을 띄운다. 인프라가 꼬이면 언제든 같은 명령으로 초기화한다.

- `compose.yml` — 진입점. 아래 파일들을 include하고, 모든 준비가 끝나면 종료되는 `infra-setup` 서비스를 정의한다(`reset.sh`가 이 종료로 준비 완료를 판단한다).
- `compose.common.yml` — 모든 서비스가 공유하는 로깅·healthcheck 공통 옵션.
- `compose.mongo.yml` — MongoDB Replica Set. 트랜잭션이 Replica Set을 요구한다.
- `compose.redis.yml` — Redis Cluster. 스탠드얼론에서는 통과하지만 Cluster에서만 실패하는 코드가 개발 단계에서 드러나게 한다.
- `compose.s3.yml` — VersityGW POSIX backend 기반 S3 호환 스토리지. 애플리케이션은 구현체 전용 API 없이 AWS SDK v3의 S3 API만 사용한다.
- `compose.nats.yml` — 컨테이너 사이 pub/sub.
- `restate/compose.restate.yml` — 단일 Restate 서버와 영속 volume. ingress(8080)와 Admin API(9070)의 health가 모두 준비되어야 healthy다.

이 인프라는 세 소비자가 공유한다. dev 서버(`npm run dev`)와 `apps/api` 통합 테스트가 직접 붙고, 검증용 4-replica 배포 스택(`deploy/`)도 같은 Docker 네트워크(`COMPOSE_PROJECT_NAME`)에 붙어 서비스 이름(`mongo1`, `redis1`, `restate` 등)으로 접근한다. 접속 값의 정의처는 `.env.infra`다.

Restate는 Temporal 서버·별도 PostgreSQL·스키마/namespace setup을 대신하는 단일 컨테이너다. API endpoint는 여러 복제본이지만 이 개발용 Restate 서버 자체는 한 인스턴스라 HA 구성이 아니다. `infra/reset.sh`의 `down -v`는 개발용 Restate journal도 함께 초기화한다. 일반 컨테이너 재시작은 `restate_data` volume을 보존하지만, reset은 실행 기록을 지우는 개발·테스트 전용 작업이다.

Restate가 API 내부 워크플로 구현을 호출하려면 서비스 endpoint를 한 번 등록해야 한다. `npm run dev`는 API와 함께 `dev:restate`를 실행해 [`register-restate.js`](../apps/api/scripts/register-restate.js)가 `http://${COMPOSE_PROJECT_NAME}:9080`을 Admin API에 개발용 `force: true`로 등록한다. 검증 배포는 복제본 하나를 직접 등록하지 않고 NGINX의 안정적인 `http://nginx:9080` endpoint를 `force: false`로 등록한다([deploy 문서](deploy.md)). 운영에서 `force` 등록은 실행 중인 invocation의 routing을 바꿀 수 있으므로 개발 편의 설정을 그대로 복사하지 않는다.

토폴로지를 운영과 같게 두는 이유는 [설계 결정 §5](reference/decisions.md#5-개발-환경-dev-container-단일-경로)가, 환경 변수가 여기서 앱까지 흐르는 전체 경로는 [환경 변수](reference/environment.md)가 설명한다. 각 설정값의 사유는 compose 파일의 현장 주석에 있다.
