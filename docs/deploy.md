# deploy/ — 다중 복제본 검증 스택

> **운영 배포본이 아니다.** API 복제본·NGINX·개발 인프라로 분산 동작을 재현하는 검증용 참고 스택이다. TLS, secret 관리, backup/restore, 모니터링, frontend 배포, 무중단 revision 전환은 별도로 설계해야 한다.

```text
client ─→ NGINX ─┬→ API replica
                ├→ API replica ─→ MongoDB / Redis / NATS / Restate / S3
                └→ API replica
Restate ─→ NGINX HTTP/2 endpoint ─→ API replica
```

`bash deploy/verify.sh`는 이 스택을 새로 띄워 실행 가능한 API 문서와 배포 경계를 검증한 뒤 정리한다. 세부 빌드·Compose 순서와 이미지 설정은 스크립트·Dockerfile·Compose 파일이 소유한다.

## 1. 왜 복제본이 여러 개인가

이 스택의 목적은 처리량 시연이 아니라 **프로세스 경계를 넘는 정확성 검증**이다. NATS fan-out, 분산 락, lease owner CAS, MongoDB write conflict, 원자 상태 전이는 복제본 하나로는 실제 경쟁을 만들지 못한다. 복제본 수는 이 검증 정책의 일부이므로 단순히 줄이면 테스트의 의미가 바뀐다.

## 2. Restate endpoint 등록과 운영 전환

Restate는 workflow를 실행할 API endpoint를 별도로 알아야 한다. 검증 스택은 개별 복제본 대신 NGINX의 안정적인 HTTP/2 endpoint를 등록해 복제본 하나가 종료되어도 invocation을 다른 복제본으로 보낸다.

일반 HTTP health가 성공했다고 endpoint 등록과 workflow dispatch까지 성공한 것은 아니다. workflow가 실행되지 않으면 앱 health보다 Restate의 deployment 등록 상태를 먼저 확인한다.

개발 환경에서 workflow 코드나 manifest를 바꾼 뒤 기존 URI를 계속 쓰면 Restate가 이전 deployment를 유지할 수 있다. 보존할 journal이 없을 때는 `infra/reset.sh`로 초기화할 수 있지만, 이 명령은 실행 기록을 삭제하므로 운영 전환 방법이 아니다.

운영에서는 revision별로 구별되는 endpoint를 등록하고, 이전 revision의 invocation이 끝날 때까지 해당 revision을 유지한 뒤 제거해야 한다. 검증 스택의 고정 URI와 강제 재등록을 무중단 배포 절차로 복사하지 않는다.

```text
v1 실행 유지 → v2 등록 → 새 invocation을 v2로 전환 → v1 drain 확인 → v1 제거
```

## 3. 프런트엔드 BFF와 클라이언트 IP 경계

`console`·`user-app`을 운영에 배포할 때는 브라우저가 Next.js 서버에 직접 접근하지 못하도록 신뢰할 수 있는 edge 뒤에 둔다. edge는 외부의 proxy IP 헤더를 그대로 신뢰하지 말고 실제 연결 주소를 기준으로 체인을 재구성해야 한다.

BFF의 proxy header 신뢰는 기본적으로 꺼져 있다. 위 경계를 보장한 배포에서만 opt-in한다. 그렇지 않으면 공격자가 위조한 IP로 rate limit을 우회하거나 정상 사용자가 하나의 BFF 주소로 묶일 수 있다. API도 BFF/NGINX에서만 접근할 수 있는 사설 경계에 둔다.

쿠키의 운영 기본값은 `Secure`다. TLS가 없는 내부 테스트 네트워크의 override는 그 테스트에만 한정하고 일반 production 설정으로 옮기지 않는다.

```text
인터넷 → 신뢰 edge(X-Forwarded-For 재구성) → BFF → 사설 API
인터넷 ────────────────────────────────╳→ BFF·API 직접 접근
```

## 4. 로그 계약

API와 NGINX는 구조화된 한 줄 로그를 stdout/stderr로 내보낸다. 요청·응답 본문과 query는 기록하지 않는다. 컨테이너 안의 별도 로그 파일은 stdout을 중복하고 교체 시 사라지므로 만들지 않는다. 수집·저장·보존·접근 제어는 실제 배포 환경의 로그 backend가 소유한다.

## 5. `x-replica-id` 응답 헤더

모든 API 응답은 처리한 복제본을 식별하는 `x-replica-id`를 포함한다. 이 헤더는 외부 API 기능이 아니라, 분산 테스트가 요청이 여러 복제본에 실제로 나뉘었음을 증명하기 위한 관측 장치다.

```http
HTTP/1.1 200 OK
x-replica-id: api-replica-2
```

값은 처리한 컨테이너의 hostname이다. 문자열 형식 자체는 외부 계약이 아니며, 테스트는 동시 요청에서 서로 다른 값이 관측됐는지만 확인한다.
