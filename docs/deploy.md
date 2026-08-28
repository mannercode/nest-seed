# deploy/ — 다중 복제본 검증 스택

> **운영 배포본이 아니다.** 이 폴더는 API 복제본 4개와 NGINX를 띄워 실행 가능한 API 문서·분산 레이스·성능 하네스를 재현하는 참고 스택이다. 커밋된 개발 env, HTTP NGINX, 외부에 이미 띄워진 개발 인프라를 사용한다. TLS·secret manager·백업/복구·모니터링·무중단 오케스트레이션·console/user-app 배포는 별도로 설계해야 한다.

Docker Compose로 API 컨테이너를 여러 개 띄우고 NGINX로 요청을 나눈다. Node.js는 기본적으로 한 프로세스가 한 이벤트 루프를 쓰기 때문에, 컨테이너를 나누어 여러 CPU 코어를 활용한다.

MongoDB, Redis, VersityGW, NATS, Temporal 같은 인프라는 이미 실행 중이라고 가정한다.

토폴로지는 다음과 같다(다이어그램은 devcontainer의 VS Code 미리보기에서 렌더된다).

```plantuml
@startuml
skinparam componentStyle rectangle

rectangle "호스트 :3000" as hostport
rectangle "Docker 네트워크 (COMPOSE_PROJECT_NAME)" {
    [NGINX\nleast_conn] as nginx
    [api-1] as a1
    [api-2] as a2
    [api-3] as a3
    [api-4] as a4
    database "MongoDB\nReplica Set ×3" as mongo
    database "Redis\nCluster ×3" as redis
    queue NATS as nats
    [Temporal\n(+PostgreSQL)] as temporal
    [VersityGW\n(S3 API)] as s3
    [devcontainer] as dev
}

hostport --> nginx
nginx --> a1
nginx --> a2
nginx --> a3
nginx --> a4
a1 --> mongo
a1 --> redis
a1 --> nats
a1 --> temporal
a1 --> s3
note bottom of a1
  네 컨테이너 모두 같은 인프라에
  서비스 이름(mongo1, redis1, ...)으로 접근한다
end note
dev ..> nginx : http://nginx\n(verify.sh · api-race/api-benchmark 러너)
@enduml
```

## 구성

| 파일                   | 설명                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `compose.yml`          | API 컨테이너 N개 + NGINX 로드밸런서                                                                 |
| `nginx.conf`           | 연결 수가 가장 적은 컨테이너로 보내는(`least_conn`) 리버스 프록시, upstream 정보를 담은 액세스 로그 |
| `deps.Dockerfile`      | lockfile 기준 node_modules를 담은 베이스 이미지 (API 이미지 빌드가 참조)                            |
| `ensure-deps-image.sh` | 의존성 입력의 합본 해시로 `DEPS_TAG`를 계산하고, 해당 태그 이미지가 없으면 빌드                     |
| `prebuild-images.sh`   | Stability 반복 전 deps·API·NGINX 이미지를 한 번만 준비. 실패하면 짧은 backoff로 최대 3회 시도       |
| `verify.sh`            | deps 이미지 보장 → compose up → [../apps/api/api-docs/run.sh](../apps/api/api-docs/run.sh) → down   |

## 주요 설정

| 변수                   | 기본값                                                  | 설명                                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `COMPOSE_PROJECT_NAME` | 필수 (devcontainer: 사용자명과 workspace basename 조합) | API와 개발 인프라가 공유할 Docker 네트워크 이름                                                                                                                                                                            |
| `DEPS_TAG`             | 자동 계산                                               | deps 이미지 태그. `ensure-deps-image.sh`를 source하면 lockfile·npm 정책·Dockerfile·workspace manifest의 합본 해시로 태그를 계산해 export하고, 이미지가 없으면 그 자리에서 빌드한다. `verify.sh`가 이 스크립트를 source한다 |

베이스·NGINX·인프라 이미지 참조는 사람이 읽을 버전 태그와 실제 바이트를 고정하는 multi-architecture digest를 같이 둔다. 버전을 올릴 때는 태그와 digest를 함께 확인·갱신한다.

스택을 띄워 둔 채 쓰려면(예: api-benchmark 반복 측정 — `verify.sh`는 검증 후 바로 내린다) 다음처럼 직접 띄운다.

```bash
cd deploy && export COMPOSE_IGNORE_ORPHANS=True && source ensure-deps-image.sh && docker compose up -d --build --wait
# 끝나면: docker compose down -v
```

스택을 반복해 띄우는 CI는 반복 안에서 이미지를 다시 빌드하지 않도록 먼저 다음을 실행한다.

```bash
bash deploy/prebuild-images.sh
DEPLOY_IMAGES_PREBUILT=true bash tests/api-race/runner.sh <scenario>
```

`DEPLOY_IMAGES_PREBUILT=true`는 `nest-seed-api`가 이미 존재할 때만 `docker compose up --no-build`로 재사용하라는 로컬 하네스 계약이다. 이미지가 없으면 실패하며 원격 레지스트리에 올리거나 운영 배포를 하지 않는다. 일반 `verify.sh`는 소스 변경을 포함하려고 그대로 `--build`를 사용한다.

API 컨테이너 개수(4)와 NGINX가 호스트에 노출하는 포트(3000)는 운영자가 바꾸는 값이 아니라 검증 정책이므로 [compose.yml](../deploy/compose.yml)에 직접 고정한다. 복제본을 여러 개로 두는 것 자체가 시드의 전제다. NATS fan-out, 락·lease owner CAS, Mongo 트랜잭션 경합, 원자 상태 전이는 모두 복제본 사이 경쟁을 다루므로, 1개로 줄이면 핵심 패턴이 실제로 경쟁하지 않은 채 통과한다.

API 컨테이너는 `${COMPOSE_PROJECT_NAME}` Docker 네트워크에 붙은 뒤, 서비스 이름(`mongo1`, `redis1`, `nats`, `temporal`, `s3` 등)으로 인프라에 접근한다. devcontainer에서는 `infra` compose와 `deploy/compose.yml`이 같은 네트워크를 공유한다.

환경 변수가 컨테이너로 들어오는 경로는 [환경 변수](reference/environment.md)가 정리한다. deploy 고유의 값은 배포 시점에 덮어쓰는 `NODE_ENV=production`, `LOG_DIRECTORY=/app/logs` 등이며, compose.yml의 `environment`에 둔다.

`verify.sh`는 Dev Container 환경 변수인 `WORKSPACE_ROOT`를 사용한다. 배포 검증도 Dev Container 안에서 실행하는 것을 기준으로 한다.

## 프런트엔드 BFF와 클라이언트 IP 경계

이 Compose 스택은 API만 배포한다. `console`과 `user-app`을 운영에 함께 배포할 때는 두 Next.js 서버를 신뢰할 수 있는 edge/reverse proxy 뒤에 두고, 브라우저가 Next origin에 직접 접근하지 못하게 제한해야 한다. edge는 외부 요청의 `X-Forwarded-For`를 그대로 신뢰하지 않고 실제 연결 주소를 체인의 오른쪽 끝에 append하며, `X-Real-IP`는 실제 연결 주소로 덮어써야 한다.

BFF는 기본적으로 proxy IP 헤더를 무시한다. 위 경계를 보장한 배포에서만 두 Next.js 서버에 `BFF_TRUST_PROXY_HEADERS=true`를 명시해 opt-in한다. 이때 BFF는 `X-Forwarded-For`의 오른쪽 끝 값 하나(헤더가 없으면 검증된 `X-Real-IP`)가 실제 IP일 때만 API로 전달한다. 오른쪽 끝 값이 잘못됐다고 앞쪽 값으로 후퇴하지 않는다.

API는 `loopback`·`linklocal`·`uniquelocal` 프록시만 신뢰하므로, API 포트 역시 사설 네트워크의 BFF/NGINX에서만 접근 가능해야 한다. 이 경계를 보장할 수 없는 환경에서는 opt-in하지 말고 IP 제한을 신뢰 가능한 edge로 옮겨야 한다. 기본값에서는 모든 요청이 API 관점에서 BFF 주소 하나로 보이므로 IP별 로그인 버킷도 공유된다는 점에 유의한다.

이 경계는 `deploy/verify.sh`가 아니라 각 테스트 계층이 자기 범위만 검증한다.

- [BFF 계약 테스트](../tests/web/contracts/bff-proxy.spec.ts)는 기본값에서 proxy IP 헤더를 무시하는 규칙, opt-in에서 오른쪽 끝 IP만 선택하는 규칙, 잘못된 끝값에서 앞쪽 공격자 값으로 후퇴하지 않는 규칙을 두 Next.js 앱에 공통으로 검증한다.
- Playwright는 두 BFF를 의도적으로 `BFF_TRUST_PROXY_HEADERS=true`로 시작한다. 브라우저가 보낸 `X-Forwarded-For`로 신뢰 edge를 모사해 서로 다른 주소의 로그인 실패가 별도 IP 버킷에 쌓이는 opt-in wiring을 검증한다. 이것은 실제 public edge가 외부 헤더를 덮어쓰는지는 증명하지 않는다.
- API 인증 통합 테스트는 프로세스 안에서 trusted-proxy 해석과 로그인 rate-limit 동작을 검증한다. Compose의 BFF·edge 경계를 통과하는 통합 검증은 아니다.

## 상영 생성 v1 → v2 마이그레이션

신규 상영 생성은 `showtimeCreationWorkflowV2`와 v2 task queue로 들어가고, MongoDB 트랜잭션·극장 스케줄 guard CAS·`sagaId` operation으로 멱등 재시도한다. 동시에 새 바이너리는 배포 전부터 시작한 `showtimeCreationWorkflow` v1 history를 완료하는 legacy queue·worker·bundle·Activity도 함께 포함한다.

v1 워크플로의 Activity 명·timeout·retry·보상 순서를 v2와 맞추려고 바꾸지 않는다. Temporal history에 이미 기록된 명령과 다르면 replay가 비결정적 오류로 실패한다. v2 Activity가 v1과 같은 Redis 키를 잠시 사용하는 것도 구 바이너리와 공존할 때 비-트랜잭션 v1 쓰기를 교차 직렬화하는 호환 fence이지 v2 정합성 장치가 아니다.

롤링 교체 중에도 데이터 경쟁은 차단되지만, v1 Activity가 긴 락을 보유하면 v2의 5분 SSE 대기 상한 안에 끝나지 못할 수 있다. 상영 생성의 무중단 완료까지 필요하면 다음 순서로 drain한다.

1. 새 상영 생성 유입을 잠시 중지하고, 구 복제본이 더 이상 v1 워크플로를 enqueue하지 않게 한다.
2. Temporal Web UI/운영 조회에서 v1 workflow type과 legacy task queue의 open execution·실행 중 Activity가 0인지 확인한다. 실행 중인 건은 구 worker 또는 새 바이너리의 legacy worker가 끝내게 둔다.
3. 구 복제본을 모두 내리고 v1·v2 worker를 모두 포함한 동일한 새 이미지로 교체한다.
4. v2 상영 생성 하나를 실행해 `succeeded`/의도한 `failed`로 종결하고, 상영 시간·티켓·operation 기록이 일치하는지 확인한 뒤 유입을 재개한다.
5. legacy 코드와 호환 락 제거는 v1 open execution이 0임을 운영에서 확인한 **다음 별도 릴리스**로 미룬다.

## 인증·구매 상태 스키마 교체

`authVersion`과 구매 상태 머신을 처음 도입하는 버전은 구·신 API 바이너리를 함께 서비스하지 않는다. 기존 DB 문서와 `authVersion` claim이 없는 version 0 토큰은 신 버전이 읽을 수 있지만, 구 버전은 신 `pending`/`compensating` 구매 기록을 완료 구매처럼 노출할 수 있다.

따라서 이 릴리스는 새 구매 유입을 잠시 중지하고 기존 복제본을 모두 내린 뒤 동일 이미지로 한 번에 교체한다. 교체 후 `pending`/`completing`/`compensating` 기록이 재조정 주기에서 정상 수렴하는지 확인한 뒤 트래픽을 다시 연다.

## `x-replica-id` 응답 헤더

[bootstrap.ts](../apps/api/src/bootstrap.ts)의 미들웨어는 모든 HTTP 응답에 `x-replica-id: <os.hostname()>`를 넣는다. 컨테이너 hostname이 API 컨테이너의 고유 ID 역할을 한다. 클라이언트와 분산 테스트는 이 헤더로 NGINX가 실제로 여러 컨테이너에 요청을 나누었는지 확인한다.
