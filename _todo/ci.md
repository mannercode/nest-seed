# CI 실패 원인 조사

## 진행 대상

### 회원가입 Race의 실행 시간 초과

- [ ] 19MiB·2회·병렬도 1 설정으로 회원가입 Race 25회가 작업 제한 안에 완료되는지 확인한다.

근거: [2026-10-27 user-signup-race](https://github.com/mannercode/nest-seed/actions/runs/40504196718/job/122189214678)는 커밋 `66dd3f2c`에서 20회까지 통과한 뒤 21회차에 240분 작업 제한으로 취소됐다. 한 회차에 약 11분 40초가 걸렸고, 중단 직전까지 내부 검사는 통과했다. 마지막 호스트 지표에는 CPU idle이 거의 0%로 기록돼 있다.

실패한 커밋은 Argon2id의 기본 비용인 메모리 64MiB·3회·병렬도 4를 사용했다. 수정한 [PasswordHasher](../libs/common/src/auth/password.ts)와 관리자 생성 스크립트는 19MiB·2회·병렬도 1을 사용하며, 이 설정으로 CI 반복 검증이 필요하다.

비교 근거: [교체 전 커밋 `51f0c9b2`의 같은 Race](https://github.com/mannercode/nest-seed/actions/runs/40415119853/job/121895366763)는 50회를 완주했다. 회차 시작 간격의 중앙값은 교체 전 233.461초, 교체 후 701.076초로 약 3배다. 두 실행의 반복·동시 요청 수와 `UV_THREADPOOL_SIZE=16`은 같고, 가입 테스트의 요청 변경은 비밀번호 문자열이다. 동일한 로컬 x64 환경에서 작업 스레드 16개로 해시 64건을 동시에 생성한 비교도 3회 중앙값이 bcrypt(cost 10) 247ms, Argon2id의 64MiB·3회·병렬도 4 설정 2,742ms였다. 로컬 측정값은 CI ARM의 절대 성능을 대신하지 않지만 해시 비용 증가를 뒷받침한다.

최소 범위: 사용자 요청에 따라 기존 반복 횟수를 절반으로 줄여 API Race는 25회, Stability는 libs 38회·API 30회·infra-reset 25회 반복한다. libs는 75회의 절반을 올림한다. 각 회차의 경쟁 요청과 결과 검증은 유지하며, 변경한 반복 구성에서 실행 시간과 실패 내용을 확인한다.

검증: CI에서 회원가입 Race 25회 모두의 결과와 전체 실행 시간을 확인한다. 로컬 해시 측정과 단위·통합 테스트의 통과만으로 CI 시간 초과 해결을 판정하지 않는다.

### 로그인 중 Redis 트랜잭션 중단

- [ ] `EXECABORT`를 일으킨 선행 명령의 오류를 확인한다.

근거: [2026-10-27 ticket-holding-race](https://github.com/mannercode/nest-seed/actions/runs/40504196718/job/122189215266)의 3/50회차에서 테스트 사용자 로그인에 HTTP 500이 발생했다. 좌석 선점 요청 전의 실패다. API 로그의 세션 발급 `MULTI/EXEC`에는 `EXECABORT Transaction discarded because of previous errors.`가 기록됐지만, `previousErrors`에는 명령만 있고 오류 메시지가 없다. 당시 API와 Redis 컨테이너는 실행 중이었고 `OOMKilled=false`, 재시작 횟수 0이었다. CPU 포화도 관찰됐으나 그것이 트랜잭션 중단의 원인인지는 확인하지 못했다.

최소 범위: [JwtAuthService.generateAuthTokens](../libs/common/src/auth/jwt-auth.service.ts)의 기존 오류에서 명령별 메시지를 확보하고 Redis 응답·클러스터 연결 상태와 대조한다. 오류 정보가 없는 상태에서 retry·timeout·세션 저장 방식을 바꾸지 않는다.

검증: 로컬 Redis Cluster에서 같은 `SET`·`SADD`·`PEXPIRE` 트랜잭션을 250건씩 8회 실행한 2,000건은 모두 성공했다. 별도 진단 키만 사용하고 제거했다. CI 실패와 같은 부하에서 선행 오류를 확보한 뒤 기존 인증 테스트와 ticket-holding Race로 확인해야 한다.

### 동시에 생성한 MongoDB 인덱스 누락

- [ ] 두 초기화 호출이 끝났는데 인덱스 하나만 조회된 원인을 확인한다.

근거: [2026-10-27 Stability/libs](https://github.com/mannercode/nest-seed/actions/runs/40504095121/job/122188865604)의 63/75회차에서 [crud.repository.spec.ts](../libs/common/src/mongodb/__tests__/crud.repository.spec.ts) 423행이 실패했다. `Promise.all`로 두 저장소의 초기화를 기다린 뒤 조회했지만, 기대한 `name_1_secret_1`·`secret_1_name_1` 중 첫 번째만 있었다. 나머지 테스트 763개는 통과했다.

최소 범위: [CrudRepository.onModuleInit](../libs/common/src/mongodb/crud.repository.ts)의 초기화 공유 여부와 실제 두 `createIndexes` 요청·응답, 직후 `listIndexes` 응답을 함께 확인한다. 현재 BSON 비교 키는 필드 순서를 구분하며 로컬에서도 두 키가 다름을 확인했다. 서버 응답이 남아 있지 않아 초기화 공유·드라이버·서버 중 어느 쪽 문제인지 아직 확정하지 못했다.

검증: 로컬 x64의 별도 MongoDB 9.0.4 컨테이너와 드라이버 7.6.0에서 필드 순서가 다른 인덱스를 동시에 만드는 직접 호출 500회는 모두 성공했다. 대량 생성 진단의 열린 파일 제한은 65,536으로 설정했으며 CI ARM 환경과 같지 않다. 저장소·Vitest를 포함한 CI 조건에서 재현하고, 수정 후 기존 동시 초기화 검사와 common 전체 테스트·커버리지를 확인해야 한다.

### NATS 연결 실패

- [ ] Stability의 NATS 연결 실패 원인을 확인한다.

근거: [2026-10-23 Stability의 libs 작업](https://github.com/mannercode/nest-seed/actions/runs/39949070564/job/120398804259)은 커밋 `b4519f15`의 60/75회차에서 실패했다. 해당 회차 초반 NATS 메시지 송수신은 성공했지만, 이후 `connect EHOSTUNREACH 172.17.0.1:33129`와 연결 timeout으로 NATS 관련 테스트 25개가 실패했다. MongoDB·Redis·S3를 포함한 나머지 테스트 파일 37개는 통과했다. 초기화에 실패한 fixture를 정리하면서 발생한 `teardown`·`streams` 오류도 있지만 최초 연결 실패의 원인은 아니다.

필요한 이유: 같은 커밋의 후속 반복 실행은 통과했으나 당시 NATS 컨테이너 로그·종료 상태와 Docker 이벤트가 남아 있지 않다. 컨테이너 종료·OOM·네트워크 문제 중 무엇인지, 저장소 코드가 원인인지 아직 판정할 수 없다.

최소 범위: [NATS 테스트 컨테이너 준비·정리](../libs/common/vitest.global.cjs)와 해당 실행의 NATS 연결 경로를 조사한다. 재현 실행에서는 컨테이너가 정리되기 전에 NATS 로그, 종료 코드·OOMKilled 상태, Docker 종료·네트워크 이벤트를 확보하고 최초 연결 실패 시각과 대조한다.

검증: 원인에 해당하는 실패 조건을 재현한 뒤 수정 범위를 정한다. 기존 NATS 테스트와 common 전체 테스트·커버리지, Stability 반복 검사를 확인한다. 단순 재실행 통과만으로 원인 해결을 판정하지 않는다.

## 보류

- `fix.teardown()`·`manager.streams`의 초기화 실패 후 정리 오류는 연결 실패와 별도다. 최초 실패를 가리지 않는 정리가 필요한지 후속 수정에서 함께 판단한다.
