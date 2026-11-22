# 개발 인프라

개발 서버와 API 테스트는 같은 Docker 네트워크에서 아래 서비스를 공유한다. 이미지·포트·접속 정보는 [루트 인프라 설정](../.env.infra)에 있다.

## 1. 로컬에서 실행하는 서비스

| 구성                | 이 환경에서 확인하는 동작                           |
| ------------------- | --------------------------------------------------- |
| MongoDB Replica Set | 여러 문서를 함께 바꾸는 트랜잭션과 과반수 쓰기 확인 |
| Redis Cluster       | 한 명령에 쓰는 키의 hash slot과 노드 주소 탐색      |
| VersityGW S3        | 서명한 요청으로 파일 업로드·다운로드                |
| NATS·JetStream      | 메시지 저장과 API 복제본 간 이벤트 전달             |
| Restate             | 서버 재시작 후 작업 재개                            |

## 2. 인프라 시작과 데이터 초기화

Dev Container에서 `bash infra/reset.sh`를 실행하면 개발 인프라의 컨테이너와 볼륨을 삭제하고 다시 만든다. **계정, Redis 세션, S3 파일, JetStream 메시지, Restate 작업 기록이 모두 삭제된다.** Dev Container 시작과 `pnpm run atoz`에서도 이 스크립트가 실행된다. 필요한 데이터가 있다면 먼저 보관한다.

MongoDB는 PRIMARY 하나와 SECONDARY 둘이 준비된 뒤 과반수 쓰기에 성공해야 한다. Redis Cluster와 S3 버킷까지 준비되고 NATS·Restate가 응답하면 스크립트가 끝난다. 초기 계정은 web이나 가입 API에서 직접 만든다. 루트 환경 변수 파일을 수정했다면 [Dev Container를 다시 만든다](../.devcontainer/README.md#1-환경-변수-파일-변경-후-dev-container-재생성).

## 3. 네트워크와 포트

Dev Container와 각 Compose 프로젝트는 같은 외부 Docker 네트워크에서 서비스 이름으로 통신한다. 인프라 포트는 호스트에 공개하지 않는다. MongoDB·Redis의 주소를 바꾸면 앱의 접속 설정뿐 아니라 각 노드가 클라이언트에 알려 주는 주소와 초기화 스크립트도 맞춘다.

## 4. Restate에 workflow 실행 주소 등록

`pnpm run dev`는 Restate에 Dev Container의 API 주소를 등록한다. [개발용 등록 스크립트](../apps/api/scripts/register-restate.cjs)는 `COMPOSE_PROJECT_NAME`과 `RESTATE_SERVICE_PORT`로 주소를 만든다.

API 문서·race·benchmark는 API 복제본 앞에 있는 NGINX의 주소를 등록한다. API가 수신하는 포트를 변경하면 [NGINX upstream](../tests/api/nginx.conf)도 바꾼다. NGINX가 Restate 요청을 받는 포트를 변경하면 [Compose의 등록 주소](../tests/api/compose.yml)도 바꾼다.

개발 실행기는 같은 주소를 강제로 재등록하고 검증용 Compose는 `force: false`로 등록한다. 진행 중인 작업을 이어서 실행해야 한다면 새 버전을 별도 주소로 등록하고 기존 작업이 끝날 때까지 이전 주소에서 이전 코드를 실행한다.
