# infra/ — 개발 인프라

개발 서버·API 통합 테스트·다중 복제본 검증이 공유하는 인프라다. 서비스는 Compose, 접속 정보·이미지·포트는 루트 `.env.infra`에서 설정한다.

## 1. 개발 환경에서도 분산 구성을 사용하는 이유

| 구성                | 확인하는 동작                                       |
| ------------------- | --------------------------------------------------- |
| MongoDB Replica Set | transaction·majority write·멤버 탐색·write conflict |
| Redis Cluster       | 다중 키 명령의 hash slot·노드 주소 탐색             |
| VersityGW S3        | 업로드·다운로드·presigned 요청                      |
| NATS·JetStream      | 복제본 간 fan-out·저장·ack·재전달                   |
| Restate             | endpoint 중단 후 journal로 실행 재개                |

mock·standalone만 사용하면 복제·분산 구성의 오류를 놓칠 수 있다. 애플리케이션이 보장하는 범위는 [앱 가이드](../apps/README.md)에 있다.

## 2. 인프라 시작과 데이터 초기화

[reset.sh](reset.sh)는 컨테이너·볼륨을 삭제하고 다시 만든다. Dev Container 시작·AtoZ 준비에도 실행하며 **MongoDB 데이터·S3 객체·Restate journal·JetStream 미처리 이벤트를 삭제한다.** 보존할 데이터·작업이 없는 개발·검증 환경에서만 실행한다.

`infra-setup`은 MongoDB·Redis Cluster·S3 bucket 초기 설정과 NATS·Restate health를 기다린다. MongoDB는 PRIMARY 하나·SECONDARY 둘이 준비되고 majority write가 성공해야 완료된다. 준비 실패는 reset 실패다. 초기 계정은 없으며 web이나 가입 API로 만든다.

reset은 루트 env를 다시 읽지 않는다. 파일을 바꿨다면 먼저 [Dev Container를 재생성](../.devcontainer/README.md#1-환경-변수-파일-변경-후-dev-container-재생성)한다.

## 3. 공유 네트워크와 복구의 한계

Dev Container·infra·검증 스택은 Compose 밖에서 만든 네트워크를 공유하며 서비스 이름으로 통신한다. 인프라 포트는 호스트에 공개하지 않는다. MongoDB·Redis는 접속 후 서버가 알려 준 멤버 주소로 연결하므로 주소·포트 변경 시 클라이언트 env·서비스·healthcheck·초기 설정을 함께 맞춘다. S3 endpoint·region도 bucket 초기 설정과 일치해야 한다.

NATS·Restate는 서버 하나, JetStream은 저장 복제본 하나이며 Redis는 데이터 복제본을 둔 HA 구성이 아니다. API 복제본의 복구를 인프라 고가용성으로 해석하지 않는다.

NATS·Restate 기록은 named volume에 있어 재시작 후에도 남고 reset하면 지워진다. [Restate 복구 테스트](tests/restate-journal-recovery.js)는 서버 재시작 뒤 완료한 step의 결과 재사용과 중단된 step의 재실행을 확인한다. 운영 클러스터·백업 복구는 검증하지 않는다.

## 4. Restate에 workflow 실행 주소 등록

서버 health와 별개로 workflow endpoint를 등록해야 한다. 개발 실행기는 Dev Container의 API를, 검증 스택은 복제본으로 분산하는 NGINX 주소를 등록한다. `PROJECT_ID`·endpoint를 바꾸면 API와 등록 실행기에 같은 값을 전달한다.

고정 URI의 코드 변경은 [검증 스택의 등록 조건](../tests/README.md#restate-등록과-포트), 작업을 보존할 revision 전환은 [배포 조건](../apps/README.md#진행-중인-작업을-보존하는-배포)을 따른다.

이미지 tag·digest는 함께 갱신하고 Dockerfile 변경 시 `.env.infra`의 이미지 변수도 확인한다.
