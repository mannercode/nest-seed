# 개발 인프라

## 1. 로컬에서 실행하는 서비스

개발 서버와 API 테스트는 MongoDB Replica Set, Redis Cluster, VersityGW(S3), NATS JetStream, Restate를 공유한다. [Compose 구성](compose.yml) · [이미지·포트·접속 설정](../.env.infra)

## 2. 인프라 시작과 데이터 초기화

Dev Container에서 `bash infra/reset.sh`를 실행하면 개발 인프라의 컨테이너와 볼륨을 다시 만든다. **계정, 세션, 업로드 파일, 메시지, 작업 기록이 모두 삭제된다.** Dev Container를 시작하거나 `pnpm run atoz`를 실행할 때도 같은 스크립트가 동작한다.

스크립트는 MongoDB 과반수 쓰기와 나머지 서비스의 준비를 확인한 뒤 종료한다. 초기 계정은 web이나 가입 API에서 만든다. [초기화 스크립트](reset.sh)

## 3. 네트워크와 포트

Dev Container와 각 Compose 프로젝트는 같은 외부 Docker 네트워크에서 서비스 이름으로 통신한다. 인프라 포트는 호스트에 공개하지 않는다. MongoDB·Redis의 주소를 바꾸면 앱의 접속 설정뿐 아니라 각 노드가 클라이언트에 알려 주는 주소와 초기화 스크립트도 맞춘다.

## 4. Restate에 workflow 실행 주소 등록

API는 workflow 리스너를 연 뒤 `RESTATE_ADMIN_URL`에 `RESTATE_DEPLOYMENT_URI`를 등록한다. 등록에 성공해야 HTTP 요청을 받는다. 배포할 때는 Restate에서 접속할 수 있는 workflow 주소를 지정한다. 단일 서버는 자신의 주소를, 같은 버전의 복제본은 모두 같은 로드 밸런서 주소를 사용한다. 같은 주소와 서비스 정의로 다시 시작하면 기존 등록을 재사용한다. [단일 서버 설정](../apps/api/compose.yml) · [복제본 설정](../tests/api/compose.yml)

API의 HTTP·workflow 포트를 바꾸면 NGINX upstream을 맞춘다. NGINX가 workflow 요청을 받는 포트를 바꾸면 Compose의 등록 주소도 바꾼다. [NGINX 설정](../tests/api/nginx.conf)

진행 중인 작업을 유지하며 배포하려면 새 버전을 별도 주소에 등록한다. 기존 작업이 끝날 때까지 이전 주소에서 이전 코드를 실행한다.

## 5. 인프라 테스트

루트의 `pnpm run test`는 `infra/tests/` 아래의 `*.test.js` 파일을 하나씩 실행한다. Restate 복구 테스트는 개발 서버와 공유하는 Restate 컨테이너를 강제 종료하고 다시 시작해, 중단된 workflow 단계만 재실행되는지 확인한다. [Restate 복구 테스트](tests/restate-journal-recovery.test.js)
