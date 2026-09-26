# infra/ — 개발 인프라

개발 서버·API 통합 테스트·다중 복제본 검증은 이 인프라를 공유한다. 서비스는 Compose 파일에서 구성하고, 접속 정보와 이미지는 루트 `.env.infra`에서 설정한다.

## 1. 이 토폴로지가 필요한 이유

| 구성                | 실제 환경에서 확인하는 동작                             |
| ------------------- | ------------------------------------------------------- |
| MongoDB Replica Set | transaction, majority write, 멤버 탐색과 write conflict |
| Redis Cluster       | 여러 key를 묶는 명령의 hash slot과 노드 주소 탐색       |
| VersityGW S3        | 업로드·다운로드·presigned 요청의 S3 프로토콜            |
| NATS·JetStream      | 복제본 간 fan-out, 저장·ack·재전달                      |
| Restate             | endpoint 중단 뒤 journal을 통한 실행 재개               |

메모리 mock이나 단일 서버로 대체하면 복제·분산 구성에서 발생하는 오류를 놓칠 수 있다. 각 도구를 선택한 이유와 애플리케이션이 보장하는 범위는 [설계 결정](reference/decisions.md)에 있다.

## 2. 시작과 reset의 범위

[infra/reset.sh](../infra/reset.sh)는 기존 컨테이너와 볼륨을 삭제한 뒤 새로 만든다. Dev Container 시작과 AtoZ 준비 단계에서도 실행한다. **MongoDB 데이터·S3 객체·Restate journal·JetStream의 미처리 이벤트가 삭제된다.** 보존할 데이터나 진행 중인 작업이 없는 개발·검증 환경에서만 사용한다.

`infra-setup`은 MongoDB·Redis Cluster·S3 bucket의 초기 설정이 성공하고 NATS·Restate가 healthy 상태가 될 때까지 기다린다. MongoDB는 PRIMARY 하나와 SECONDARY 둘이 준비되고 실제 majority write가 성공해야 준비를 마친 것으로 판단한다.

인프라가 준비되면 [독립 스크립트](../apps/api/scripts/admin-create.cjs)로 `.env.infra`에 지정한 개발 관리자 계정을 생성한다. common을 빌드하기 전에도 실행할 수 있도록 MongoDB와 bcrypt를 직접 사용한다. 인프라 준비나 계정 생성이 실패하면 reset도 실패한다.

reset은 루트 env 파일을 새로 읽지 않는다. 값을 바꿨다면 먼저 [Dev Container를 재생성](devcontainer.md#1-환경-변수는-재생성해야-반영된다)해 실행 환경을 맞춘다.

## 3. 공유 네트워크와 복구의 한계

Dev Container·infra·검증 스택은 외부 Docker 네트워크를 공유하며 서비스 이름으로 통신한다. 인프라 포트는 호스트에 공개하지 않는다. MongoDB와 Redis는 최초 접속 뒤 서버가 알려 주는 멤버 주소로 다시 연결하므로, 주소나 포트를 바꿀 때 클라이언트 환경 변수·서비스·healthcheck·초기 설정을 함께 맞춘다. S3의 endpoint와 region도 bucket 초기 설정과 일치해야 한다.

개발 NATS와 Restate는 각각 서버 하나다. JetStream의 저장 복제본도 하나이며 Redis는 데이터 복제본을 둔 고가용성(HA) 클러스터가 아니다. API 복제본이 복구된다는 사실이 인프라 서버 자체의 고가용성을 뜻하지는 않는다.

NATS·Restate 기록은 named volume에 저장하므로 컨테이너를 재시작해도 남지만 reset하면 사라진다. [Restate 복구 테스트](../infra/tests/restate-journal-recovery.js)는 실제 서버를 종료·재시작해 완료한 step은 결과를 재사용하고 중단된 step은 다시 실행하는지 확인한다. 운영 환경의 클러스터 구성이나 백업·복구까지 검증하지는 않는다.

## 4. Restate endpoint 연결

서버 health가 정상이더라도 workflow endpoint는 별도로 등록해야 한다. 개발 실행기는 Dev Container 안의 API 주소를 등록하고, 검증 스택은 NGINX 주소 하나를 등록해 API 복제본들에 요청을 전달한다.

고정 URI를 사용하는 검증 스택에서 코드를 바꿀 때의 제약은 [tests 가이드](tests.md)에 있다. 진행 중인 작업을 보존하면서 배포 revision을 바꾸는 방법은 [설계 결정](reference/decisions.md)을 따른다. `PROJECT_ID`나 endpoint 설정을 바꿨다면 API와 등록 실행기에 같은 값을 전달해야 한다.

이미지의 tag와 digest는 함께 갱신한다. Dockerfile을 갱신할 때 `.env.infra`의 이미지 변수도 별도로 확인한다.
