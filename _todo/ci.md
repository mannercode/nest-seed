# CI에서 NATS 연결이 끊기는 원인 조사

## 진행 대상

- [ ] Stability의 NATS 연결 실패 원인을 확인한다.

근거: [2026-10-23 Stability의 libs 작업](https://github.com/mannercode/nest-seed/actions/runs/39949070564/job/120398804259)은 커밋 `b4519f15`의 60/75회차에서 실패했다. 해당 회차 초반 NATS 메시지 송수신은 성공했지만, 이후 `connect EHOSTUNREACH 172.17.0.1:33129`와 연결 timeout으로 NATS 관련 테스트 25개가 실패했다. MongoDB·Redis·S3를 포함한 나머지 테스트 파일 37개는 통과했다. 초기화에 실패한 fixture를 정리하면서 발생한 `teardown`·`streams` 오류도 있지만 최초 연결 실패의 원인은 아니다.

필요한 이유: 같은 커밋의 후속 반복 실행은 통과했으나 당시 NATS 컨테이너 로그·종료 상태와 Docker 이벤트가 남아 있지 않다. 컨테이너 종료·OOM·네트워크 문제 중 무엇인지, 저장소 코드가 원인인지 아직 판정할 수 없다.

최소 범위: [NATS 테스트 컨테이너 준비·정리](../libs/common/vitest.global.cjs)와 해당 실행의 NATS 연결 경로를 조사한다. 재현 실행에서는 컨테이너가 정리되기 전에 NATS 로그, 종료 코드·OOMKilled 상태, Docker 종료·네트워크 이벤트를 확보하고 최초 연결 실패 시각과 대조한다.

검증: 원인에 해당하는 실패 조건을 재현한 뒤 수정 범위를 정한다. 기존 NATS 테스트와 common 전체 테스트·커버리지, Stability 반복 검사를 확인한다. 단순 재실행 통과만으로 원인 해결을 판정하지 않는다.

## 보류

- `fix.teardown()`·`manager.streams`의 초기화 실패 후 정리 오류는 연결 실패와 별도다. 최초 실패를 가리지 않는 정리가 필요한지 후속 수정에서 함께 판단한다.
