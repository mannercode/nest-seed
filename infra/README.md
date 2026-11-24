# 앱 컨테이너와 개발 인프라

## 1. 로컬에서 실행하는 서비스

개발 서버와 API 테스트는 MongoDB Replica Set, Redis Cluster, VersityGW(S3), NATS JetStream, Restate를 공유한다. [Compose 구성](compose.yml) · [이미지·포트·접속 설정](../.env.infra)

## 2. 인프라 시작과 데이터 초기화

Dev Container의 저장소 루트에서 `pnpm -C infra run reset`을 실행하면 개발 인프라의 컨테이너와 볼륨을 다시 만든다. **계정, 세션, 업로드 파일, 메시지, 작업 기록이 모두 삭제된다.** Dev Container를 시작할 때도 같은 명령을 실행한다.

스크립트는 MongoDB 과반수 쓰기와 나머지 서비스의 준비를 확인한 뒤 종료한다. 초기 계정은 web이나 가입 API에서 만든다. [초기화 스크립트](reset.sh)

## 3. 네트워크와 포트

Dev Container와 앱·인프라 컨테이너는 워크스페이스의 `COMPOSE_PROJECT_NAME`과 같은 이름의 외부 Docker 네트워크에서 서비스 이름으로 통신한다. 공용 개발 인프라의 포트는 호스트에 공개하지 않는다. MongoDB·Redis의 주소를 바꾸면 앱의 접속 설정뿐 아니라 각 노드가 클라이언트에 알려 주는 주소와 초기화 스크립트도 맞춘다.

## 4. Restate에 workflow 실행 주소 등록

API는 workflow 리스너를 연 뒤 `RESTATE_ADMIN_URL`에 `RESTATE_DEPLOYMENT_URI`를 등록한다. 등록에 성공해야 HTTP 요청을 받는다. 배포할 때는 Restate에서 접속할 수 있는 workflow 주소를 지정한다. 단일 서버는 자신의 주소를, 같은 버전의 복제본은 모두 같은 로드 밸런서 주소를 사용한다. 같은 주소와 서비스 정의로 다시 시작하면 기존 등록을 재사용한다. [단일 서버와 복제본 설정](compose.apps.yml)

NGINX는 시작할 때 `API_PORT`와 `RESTATE_SERVICE_PORT`를 읽어 각 복제본에 연결한다. NGINX 자체가 workflow 요청을 받는 포트를 바꾸면 Compose의 등록 주소도 바꾼다. [NGINX 설정](nginx.conf)

진행 중인 작업을 유지하며 배포하려면 새 버전을 별도 주소에 등록한다. 기존 작업이 끝날 때까지 이전 주소에서 이전 코드를 실행한다.

## 5. 인프라 테스트

앱 시작·종료 명령과 앱 컨테이너를 띄우는 테스트는 같은 Compose 프로젝트를 사용한다. 두 터미널에서 이 명령들을 실행하면 `flock`이 워크스페이스의 `infra/` 디렉터리를 잠가 먼저 시작한 명령이 끝날 때까지 다음 명령을 기다리게 한다. 테스트는 앱 컨테이너 정리까지 잠금을 유지한다.

저장소 루트에서 `pnpm -C infra test`를 실행하면 `infra/tests/` 아래의 `*.test.js` 파일을 하나씩 실행한다. 루트의 `pnpm test`에도 포함된다. Restate 복구 테스트는 개발 서버와 공유하는 Restate 컨테이너를 강제 종료하고 다시 시작해, 중단된 workflow 단계만 재실행되는지 확인한다. [Restate 복구 테스트](tests/restate-journal-recovery.test.js)

### API 복제본의 Race와 Benchmark

`race`와 `benchmark`는 수동 실행과 같은 Compose 프로젝트에 NGINX와 API 복제본 4개를 띄운다. NGINX는 호스트의 `127.0.0.1:3000`을 사용한다. 종료할 때 테스트 컨테이너를 내리고, 생성한 계정·파일·작업 기록은 공유 개발 인프라에 남는다. [복제본 Compose 설정](compose.apps.yml) · [인프라 초기화](#2-인프라-시작과-데이터-초기화)

`pnpm -C infra run race`로 시나리오와 실행법을 확인한다. 가입·토큰 갱신은 한 회차 전체에서 여러 복제본이 응답했는지, SSE는 구독 연결이 여러 복제본에 분산됐는지 검증한다. [실행 가능한 시나리오](tests/api/race/)

`pnpm -C infra run benchmark`는 API가 준비되면 같은 네트워크에 k6 컨테이너를 띄워 본인 정보 읽기·수정의 처리량과 p95·p99 지연 시간을 측정한다. 같은 머신·이미지·데이터에서 결과를 비교한다. 가입·로그인·토큰 갱신은 측정에서 제외되지만 인증에 실패하면 벤치마크도 실패한다. [벤치마크 전용 Compose 설정](tests/api/benchmark/compose.yml)
