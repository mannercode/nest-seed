# 앱 컨테이너와 개발 인프라

## 1. 로컬에서 실행하는 서비스

개발 서버와 API 테스트는 MongoDB Replica Set, Redis Cluster, VersityGW(S3), NATS JetStream, Restate를 공유한다. [Compose 구성](compose.yml) · [이미지·포트·접속 설정](../.env.infra)

## 2. 인프라 시작과 데이터 초기화

Dev Container의 저장소 루트에서 `pnpm -C infra run reset`을 실행하면 개발 인프라의 컨테이너와 볼륨을 다시 만든다. **계정, 세션, 업로드 파일, 메시지, 작업 기록이 모두 삭제된다.** Dev Container를 시작할 때도 같은 명령을 실행한다.

스크립트는 Compose가 띄운 MongoDB Replica Set에 과반수 쓰기를 하고 로컬 S3에 버킷을 만든다. Redis의 모든 노드가 보고한 `cluster_state:ok`와 나머지 서비스의 준비를 확인한 뒤 종료한다. 초기 계정은 web이나 가입 API에서 만든다. [초기화 스크립트](reset.sh)

## 3. 네트워크와 포트

Dev Container의 호스트에는 `USER`가 설정되어 있어야 한다. 호스트가 컨테이너 생성 전에 `<USER>-<워크스페이스 폴더명>` 네트워크를 준비한다. Docker는 Dev Container를 이 네트워크에 연결하고, 컨테이너 안의 Compose는 같은 이름을 `COMPOSE_PROJECT_NAME`으로 받아 앱과 인프라를 연결한다. Compose 프로젝트명은 영문 소문자나 숫자로 시작하고 소문자·숫자·`-`·`_`만 사용할 수 있다. 컨테이너끼리는 서비스 이름으로 통신하고 공용 개발 인프라의 포트는 호스트에 공개하지 않는다.

Redis 노드의 주소는 `.env.infra`의 `REDIS_HOST1`·`REDIS_PORT1`부터 3번 노드까지 지정한다. 서버와 클러스터 초기화 명령, API가 이 값을 함께 사용한다. MongoDB 초기화는 `mongo1`을 통해 로컬 Replica Set을 찾고, 앱은 `MONGO_URI`에 지정된 주소로 접속한다. Compose 노드 이름이나 포트를 바꾸면 초기화 명령의 접속 대상과 Replica Set 멤버 주소, 그 노드를 쓰는 앱의 URI도 맞춘다.

## 4. Restate에 workflow 실행 주소 등록

API는 workflow 리스너를 연 뒤 `RESTATE_ADMIN_URL`에 `RESTATE_DEPLOYMENT_URI`를 등록한다. 등록에 성공해야 HTTP 요청을 받는다. 배포할 때는 Restate에서 접속할 수 있는 workflow 주소를 지정한다. 단일 서버는 자신의 주소를, 같은 버전의 복제본은 모두 같은 로드 밸런서 주소를 사용한다. 같은 주소와 서비스 정의로 다시 시작하면 기존 등록을 재사용한다. [단일 서버와 복제본 설정](compose.apps.yml)

Restate가 NGINX로 workflow 요청을 보낼 포트는 `.env.infra`의 `NGINX_RESTATE_PORT`로 지정한다. Compose의 배포 등록 주소와 NGINX 수신 포트에 함께 적용된다. NGINX는 각 API 복제본의 `RESTATE_SERVICE_PORT`로 workflow 요청을, `API_PORT`로 일반 HTTP 요청을 전달한다. [NGINX 설정](nginx.conf)

진행 중인 작업을 유지하며 배포하려면 새 버전을 별도 주소에 등록한다. 기존 작업이 끝날 때까지 이전 주소에서 이전 코드를 실행한다.

## 5. 인프라 테스트

앱 시작·종료 명령과 앱 컨테이너를 띄우는 테스트는 같은 Compose 프로젝트를 사용한다. 두 터미널에서 이 명령들을 실행하면 `flock`이 워크스페이스의 `infra/` 디렉터리를 잠가 먼저 시작한 명령이 끝날 때까지 다음 명령을 기다리게 한다. 테스트는 앱 컨테이너 정리까지 잠금을 유지한다. 종료 명령은 Compose 설정에서 대상 서비스 목록을 읽은 뒤 실행한다. 필수 변수가 빠지거나 서비스 이름이 틀리면 종료 전에 실패한다. `--remove-orphans`는 같은 프로젝트의 다른 서비스까지 삭제하므로 사용할 수 없다.

저장소 루트에서 `pnpm -C infra test`를 실행하면 `infra/tests/` 아래의 `*.test.js` 파일을 하나씩 실행한다. 루트의 `pnpm test`에도 포함된다. Restate 복구 테스트는 같은 Docker 네트워크에서 접근할 수 있는 테스트 컨테이너의 호스트명과 리스너에 배정된 포트를 Restate에 등록한다. 개발 서버와 공유하는 Restate 컨테이너를 강제 종료하고 다시 시작해, 중단된 workflow 단계만 재실행되는지 확인한다. [Restate 복구 테스트](tests/restate-journal-recovery.test.js)

### API 복제본의 Race와 Benchmark

`race`와 `benchmark`는 수동 실행과 같은 Compose 프로젝트에 NGINX와 API 복제본 4개를 띄운다. NGINX는 호스트의 `127.0.0.1:3000`을 사용한다. 종료할 때 테스트 컨테이너를 내리고, 생성한 계정·파일·작업 기록은 공유 개발 인프라에 남는다. [복제본 Compose 설정](compose.apps.yml) · [인프라 초기화](#2-인프라-시작과-데이터-초기화)

`pnpm -C infra run race`로 시나리오와 실행법을 확인한다. 가입·토큰 갱신은 한 회차 전체에서 여러 복제본이 응답했는지 확인한다. SSE는 매 회차 새 구독이 여러 복제본에 분산되고 모든 구독자가 발행된 메시지 전부를 받는지 확인한다. 이어서 구독을 취소하고 소켓이 닫힌 뒤 다음 회차를 시작한다. 복제본 장애 검사는 중단 중에 시작하고 완료된 가입과 복구 후 각 복제본의 성공 응답을 확인한다. [실행 가능한 시나리오](tests/api/race/scenarios/)

`pnpm -C infra run benchmark`는 API가 준비되면 같은 네트워크에 k6 컨테이너를 띄워 본인 정보 읽기·수정의 처리량과 p95·p99 지연 시간을 측정한다. 같은 머신·이미지·데이터에서 결과를 비교한다. 압축 비교용 읽기 두 사례는 1 KiB가 넘는 동일한 이름을 사용하고 응답의 `Content-Encoding`을 확인한다. 가입·로그인·토큰 갱신은 측정에서 제외되지만 인증에 실패하면 벤치마크도 실패한다. [벤치마크 전용 Compose 설정](tests/api/benchmark/compose.yml)
