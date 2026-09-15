# infra/ — 개발 인프라

개발 환경은 MongoDB Replica Set, Redis Cluster, S3 호환 스토리지, NATS/JetStream, Restate를 함께 띄운다. dev server, API 통합 테스트와 다중 복제본 검증 스택이 공유한다. 접속 값은 `.env.infra`, 서비스 구성은 Compose가 소유한다.

## 1. 이 토폴로지가 필요한 이유

| 구성                | 개발 단계에서 드러내려는 제약                           |
| ------------------- | ------------------------------------------------------- |
| MongoDB Replica Set | transaction, majority write, write conflict와 멤버 탐색 |
| Redis Cluster       | 여러 key를 묶는 명령의 hash slot 제약과 노드 주소 탐색  |
| VersityGW S3        | 객체 업로드·다운로드·presigned 요청의 실제 S3 프로토콜  |
| NATS와 JetStream    | 프로세스 간 fan-out과 선택한 이벤트의 저장·ack·재전달   |
| Restate             | API endpoint가 중단된 뒤 workflow journal을 통한 재개   |

스탠드얼론이나 메모리 mock으로 줄이면 실제 topology에서만 실패하는 코드가 개발 중 통과할 수 있다. 다만 이 구성이 운영의 HA·backup을 완성한다는 뜻은 아니다. 선택 이유와 한계는 [설계 결정](reference/decisions.md)에 있다.

## 2. 시작과 reset의 범위

Dev Container의 시작 단계가 `bash infra/reset.sh`를 실행한다. 이 명령은 기존 컨테이너·volume을 내리고 다시 만든다. MongoDB 데이터, S3 객체, Restate journal과 JetStream의 미처리 이벤트가 모두 초기화된다. 보존할 데이터나 실행이 없는 개발·검증 환경에서만 사용한다.

준비 완료는 컨테이너가 시작됐다는 뜻보다 강하다. `infra-setup`은 DB·Redis cluster·S3 bucket setup의 성공과 NATS·Restate의 healthy 상태를 기다린다. MongoDB는 PRIMARY 하나와 SECONDARY 둘이 준비되고 실제 majority write가 성공해야 setup을 마친다. ping만 되는 상태에서 앱 테스트를 시작하지 않기 위한 경계다.

setup 종료가 성공한 뒤 `.env.infra`의 고정 admin을 [독립 스크립트](../apps/api/scripts/admin-create.cjs)로 생성한다. 이 스크립트는 common 빌드 없이 MongoDB에 직접 접근한다. 설정이나 준비가 실패하면 reset도 실패하며 임의의 계정·대체 연결로 진행하지 않는다.

## 3. 공유 네트워크와 복구의 한계

Dev Container·infra·테스트 스택은 같은 외부 Docker network에서 service DNS로 연결한다. MongoDB Replica Set과 Redis Cluster가 클라이언트에게 알려 주는 멤버 주소도 이 네트워크에서 해석되어야 한다. 개발 인프라는 host port를 publish하지 않는다.

개발용 NATS와 Restate는 각각 한 서버다. API 복제본 네 개가 있다고 broker나 workflow runtime도 네 벌인 것은 아니다. JetStream은 단일 replica와 `nats_data`, Restate는 `restate_data` volume을 사용한다. 일반 컨테이너 재시작은 이 기록을 보존하지만 reset은 지운다. Redis도 이 개발 구성에서는 데이터 복제본을 둔 HA cluster가 아니다.

따라서 API 복제본 종료 후의 복구와 broker·workflow 서버 자체의 HA를 구분한다. 운영의 clustering·backup·복구 정책은 별도로 설계해야 한다. Restate의 journal·step 재시작 복구는 [`infra/tests/restate-journal-recovery.js`](../infra/tests/restate-journal-recovery.js)가 실제 서버 재시작으로 검증한다.

## 4. Restate endpoint 연결

Restate 서버를 시작하는 것과 실행할 workflow endpoint를 등록하는 것은 별개다. `pnpm run dev`의 등록 스크립트는 개발 API의 HTTP/2 주소를 등록하고, `tests/api` 실행기는 NGINX 뒤의 복제본들을 하나의 endpoint로 등록한다.

API health가 성공했다고 workflow dispatch까지 준비됐다고 판단하지 않는다. 검증 스택의 등록 URI·force 옵션은 [tests 문서](tests.md#5-restate-endpoint-등록), 운영의 revision 전환 조건은 [설계 결정](reference/decisions.md#endpoint와-revision-전환), env 주입 시점은 [환경 변수](reference/environment.md)가 소유한다.
