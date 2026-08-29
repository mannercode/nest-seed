# infra/ — 개발 인프라

devcontainer가 부팅할 때 `postStartCommand`로 `bash infra/reset.sh`를 실행해 이 compose 묶음을 띄운다. 인프라가 꼬이면 언제든 같은 명령으로 초기화한다.

- `compose.yml` — 진입점. 아래 파일들을 include하고, 모든 준비가 끝나면 종료되는 `infra-setup` 서비스를 정의한다(`reset.sh`가 이 종료로 준비 완료를 판단한다).
- `compose.common.yml` — 모든 서비스가 공유하는 로깅·healthcheck 공통 옵션.
- `compose.mongo.yml` — MongoDB Replica Set. 트랜잭션이 Replica Set을 요구한다.
- `compose.redis.yml` — Redis Cluster. 스탠드얼론에서는 통과하지만 Cluster에서만 실패하는 코드가 개발 단계에서 드러나게 한다.
- `compose.s3.yml` — VersityGW POSIX backend 기반 S3 호환 스토리지. 애플리케이션은 구현체 전용 API 없이 AWS SDK v3의 S3 API만 사용한다.
- `compose.nats.yml` — Core pub/sub와 구매 이벤트용 JetStream. JetStream 파일 저장소는 `nats_data` volume을 사용한다.
- `restate/compose.restate.yml` — 단일 Restate 서버와 영속 volume. ingress(8080)와 Admin API(9070)의 health가 모두 준비되어야 healthy다.
- `logging/` — 검증 배포의 stdout을 모으는 선택형 Filebeat·Elasticsearch·Kibana 스택. 기본 부팅에는 포함하지 않는다.

이 인프라는 세 소비자가 공유한다. dev 서버(`pnpm run dev`)와 `apps/api` 통합 테스트가 직접 붙고, 검증용 4-replica 배포 스택(`deploy/`)도 같은 Docker 네트워크(`COMPOSE_PROJECT_NAME`)에 붙어 서비스 이름(`mongo1`, `redis1`, `restate` 등)으로 접근한다. 접속 값의 정의처는 `.env.infra`다.

Restate는 Temporal 서버·별도 PostgreSQL·스키마/namespace setup을 대신하는 단일 컨테이너다. API endpoint는 여러 복제본이지만 이 개발용 Restate 서버 자체는 한 인스턴스라 HA 구성이 아니다. `infra/reset.sh`의 `down -v`는 개발용 Restate journal도 함께 초기화한다. 일반 컨테이너 재시작은 `restate_data` volume을 보존하지만, reset은 실행 기록을 지우는 개발·테스트 전용 작업이다.

NATS도 개발 환경에서는 한 서버이므로 JetStream의 `num_replicas: 1`은 API 컨테이너 네 개와 별개의 제약이다. 일반 NATS 컨테이너 재시작은 `nats_data`를 보존하지만 `infra/reset.sh`의 `down -v`는 개발용 stream과 미처리 이벤트를 초기화한다. 운영에서 broker 장애까지 견뎌야 한다면 NATS 서버를 세 노드 이상으로 구성하고 stream replica 수도 함께 올려야 한다.

## 선택형 중앙 로그 저장

Elasticsearch와 Kibana는 평소 테스트에 필요하지 않고 메모리도 많이 쓰므로 `infra/reset.sh`가 자동으로 띄우지 않는다. 필요할 때만 개발 인프라가 준비된 뒤 다음처럼 시작한다.

```bash
bash infra/logging/compose.sh up -d --wait
# deploy/ 스택을 실행해 API와 NGINX 로그를 만든다.
bash infra/logging/compose.sh ps
```

`deploy/compose.yml`에서 명시적으로 opt-in한 API와 NGINX 컨테이너만 Filebeat가 읽는다. 흐름은 `production 한 줄 JSON stdout → Docker json-file(10MB × 3) → Filebeat 디스크 큐(512MB) → Elasticsearch → Kibana`다. API는 ECS 필드를 출력하고, NGINX access log도 JSON으로 출력한다. `/health` 접근 로그는 수집량만 늘리므로 두 계층에서 제외한다. `pnpm run dev` 프로세스는 이 수집 대상이 아니며 개발·테스트 로그는 기존처럼 터미널에서 본다.

호스트 브라우저에서는 `http://localhost:5601`, Dev Container 안에서는 `http://log-kibana:5601`로 Kibana에 접근한다. Discover에서 `filebeat-*` data view를 만들고 시간 필드를 `@timestamp`로 고르면 API·NGINX 로그를 함께 검색할 수 있다. Elasticsearch API는 각각 `http://localhost:9200`과 `http://log-elasticsearch:9200`이다.

로그 스택은 `${COMPOSE_PROJECT_NAME}-logging`이라는 별도 Compose project와 volume을 쓴다. 그래서 일반 `infra/reset.sh`와 아래 종료 명령은 저장 로그를 지우지 않는다.

```bash
bash infra/logging/compose.sh down       # 컨테이너만 종료, 로그 volume 보존
bash infra/logging/compose.sh down -v    # 로그와 Filebeat 상태까지 명시적으로 삭제
```

ILM은 1일 또는 primary shard 10GB에서 rollover하고 7일 뒤 삭제한다. Logstash는 변환이나 여러 목적지로의 라우팅이 없는 현재 경로에선 중복 계층이라 넣지 않았다. 이 구성은 loopback 포트에 바인딩하고 인증을 끈 로컬 검증용이다. 운영에서는 Elasticsearch 인증·TLS·백업·노드 구성과 보존 기간을 별도로 설계한다.

Restate가 API 내부 워크플로 구현을 호출하려면 서비스 endpoint를 한 번 등록해야 한다. `pnpm run dev`는 API와 함께 `dev:restate`를 실행해 [`register-restate.cjs`](../apps/api/scripts/register-restate.cjs)가 `http://${COMPOSE_PROJECT_NAME}:9080`을 Admin API에 개발용 `force: true`로 등록한다. 검증 배포는 복제본 하나를 직접 등록하지 않고 NGINX의 안정적인 `http://nginx:9080` endpoint를 `force: false`로 등록한다([deploy 문서](deploy.md)). 운영에서 `force` 등록은 실행 중인 invocation의 routing을 바꿀 수 있으므로 개발 편의 설정을 그대로 복사하지 않는다.

토폴로지를 운영과 같게 두는 이유는 [설계 결정 §5](reference/decisions.md#5-개발-환경-dev-container-단일-경로)가, 환경 변수가 여기서 앱까지 흐르는 전체 경로는 [환경 변수](reference/environment.md)가 설명한다. 각 설정값의 사유는 compose 파일의 현장 주석에 있다.
