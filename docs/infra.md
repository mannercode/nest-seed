# infra/ — 개발 인프라

개발 서버·API 통합 테스트·다중 복제본 검증은 이 인프라를 공유한다. 서비스 구성은 Compose가, 접속·이미지 값은 루트 `.env.infra`가 소유한다. 운영 배포 구성을 완성하려는 폴더는 아니다.

## 1. 이 토폴로지가 필요한 이유

| 구성                | 실제 환경에서 확인할 경계                               |
| ------------------- | ------------------------------------------------------- |
| MongoDB Replica Set | transaction, majority write, 멤버 탐색과 write conflict |
| Redis Cluster       | 여러 key를 묶는 명령의 hash slot과 노드 주소 탐색       |
| VersityGW S3        | 업로드·다운로드·presigned 요청의 S3 프로토콜            |
| NATS·JetStream      | 복제본 간 fan-out, 저장·ack·재전달                      |
| Restate             | endpoint 중단 뒤 journal을 통한 실행 재개               |

메모리 mock이나 단일 서버로 바꾸면 이 경계의 실패가 개발 중 드러나지 않는다. 그렇다고 각 제품의 모든 장애나 운영 HA를 이 시드에서 구현·검증한다는 뜻은 아니다. 애플리케이션의 보장과 도구 선택 근거는 [설계 결정](reference/decisions.md)에 둔다.

## 2. 시작과 reset의 범위

[infra/reset.sh](../infra/reset.sh)는 기존 컨테이너·volume을 내린 뒤 새로 만든다. Dev Container 시작과 AtoZ 준비 단계에서도 실행한다. **MongoDB 데이터·S3 객체·Restate journal·JetStream의 미처리 이벤트가 삭제된다.** 보존할 데이터나 실행이 없는 개발·검증 환경에서만 사용한다.

준비 완료는 컨테이너 시작과 다르다. `infra-setup`은 MongoDB·Redis Cluster·S3 bucket setup의 성공과 NATS·Restate의 healthy 상태를 기다린다. MongoDB는 PRIMARY 하나와 SECONDARY 둘이 준비되고 실제 majority write가 성공해야 끝난다.

그 뒤 `.env.infra`의 고정 개발 admin을 [독립 스크립트](../apps/api/scripts/admin-create.cjs)로 생성한다. 이 스크립트는 common 빌드 없이 MongoDB와 bcrypt를 직접 사용한다. 준비나 계정 생성이 실패하면 reset도 실패한다.

reset은 루트 env 파일을 새로 읽지 않는다. 값을 바꿨다면 먼저 [Dev Container를 재생성](devcontainer.md#1-환경-변수는-재생성해야-반영된다)해 실행 환경을 맞춘다.

## 3. 공유 네트워크와 복구의 한계

Dev Container·infra·검증 스택은 외부 Docker network를 공유하며 service DNS로 통신한다. 인프라의 host port는 publish하지 않는다. MongoDB와 Redis는 최초 접속 뒤 서버가 알려 주는 멤버 주소로 다시 연결하므로, URI나 포트만 바꿔서는 충분하지 않다. 클라이언트 env·서비스·healthcheck·setup을 함께 맞춘다. S3 endpoint·region도 bucket setup과 일치해야 한다.

개발 NATS와 Restate는 각각 서버 하나다. JetStream의 저장 replica도 하나이며 Redis는 데이터 복제본을 둔 HA cluster가 아니다. API 네 복제본의 복구와 인프라 서버 자체의 HA를 구분한다.

NATS·Restate 기록은 named volume에 있어 일반 컨테이너 재시작에는 남지만 reset에는 사라진다. [Restate 복구 테스트](../infra/tests/restate-journal-recovery.js)는 실제 서버를 종료·재시작해 완료 step의 replay와 중단 step의 재실행을 확인한다. 운영의 clustering·backup/restore까지 검증하지는 않는다.

## 4. Restate endpoint 연결

서버 health와 workflow endpoint 등록은 별개다. 개발 실행기는 Dev Container 안의 API 주소를, 검증 스택은 NGINX 뒤의 API 복제본들을 하나의 endpoint로 등록한다. 일반 API health가 성공했다고 invocation 경로까지 준비된 것은 아니다.

고정 URI의 검증 스택 등록과 코드 변경 시 제약은 [tests 가이드](tests.md), 보존된 실행과 revision 전환의 관계는 [설계 결정](reference/decisions.md)을 본다. `PROJECT_ID`나 endpoint 설정을 바꿨다면 API와 등록 실행기가 같은 새 환경을 사용해야 한다.

이미지의 tag와 digest는 함께 갱신한다. `.env.infra`의 이미지 변수는 Dockerfile 자동 갱신에 포함된다고 가정하지 않는다.
