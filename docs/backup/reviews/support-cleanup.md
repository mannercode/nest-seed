# 지원 영역 정리

## 삭제

- `apps/api/src/__tests__/support/mongo-client-diagnostics.ts`: 테스트 전용 Mongo 이벤트 진단기를 삭제한다.
- Playwright JUnit reporter: 생성 파일을 소비하는 곳이 없으므로 삭제한다.
- `apps/api/api-docs/run.sh`: 소비하는 곳이 없는 `_output/docs/summary.json`과 생성용 임시 `summary.jsonl`을 제거한다. `summary.md`와 실제 응답 본문 로그는 유지한다.
- `tests/api/benchmark/harness-refresh.js`·`harness-user-filter.js`: CRUD 부하와 무관한 전용 측정을 삭제한다.

## 이동

- `tests/api/race/probes/restate-journal-recovery.js`와 Restate 테스트 의존성을 새 `tests/infra/` workspace로 옮긴다.

## 개선

- `harness-crud.js`를 극장 조회·생성만 측정하는 `crud.js`로 줄인다.
- `runner.sh`·`mixed-runner.sh`·`run-k6.sh`를 `run.sh`로 합쳐 스택 기동, 시드, 단독·혼합 부하, k6 컨테이너와 정리를 한 곳에서 실행한다.
- `perf-common.js`는 `benchmark-common.js`로 이름 바꾼다.
- benchmark 실행별 k6가 `_output/<YYYYMMDD-HHMMSS>/report.html`과 `summary.json`을 생성한다.

## 축소

- API Vitest 자원 관리: worker·test 격리는 유지하고 별도 Vitest invocation 동시 실행 지원과 실행별 coverage 경로를 제거한다.
- `tests/web/e2e/user-auth-flow.spec.ts`: 직접 MongoDB에 데이터를 넣는 개인화 fixture를 제거한다. 가입·로그인·홈·refresh·logout은 유지한다.
- API·web runner: 실패 진단 파일을 만들지 않고 Compose 상태와 로그를 터미널에 출력한다.
- 사라진 명령·산출물·도구를 설명하는 문서와 주석을 삭제하고 `test-inventory.md`를 맞춘다.

## 포기되는 기능

- JWT refresh·사용자 이름 검색·영화·health 전용 성능 측정
- 같은 Dev Container에서 별도 API Vitest 명령 두 개를 동시에 실행하는 격리

## 유지

- API 문서의 모든 요청과 실제 응답 본문
- k6 API benchmark의 CRUD 단독·혼합 부하와 gzip 비교
- 다중 복제본 race 시나리오와 Stability 반복량
- Playwright의 실제 브라우저 흐름, HTML·trace·screenshot
- PlantUML 서버·VS Code 미리보기, Lychee, VS Code tasks
- `@mannercode/dev-tools`의 `free-port`·Cloudflared tunnel 명령
- MongoDB Replica Set, Redis Cluster, S3, NATS, Restate와 파괴적 reset
- Restate 재시작 후 journal·step 복구 검증
- Vitest worker·test 자원 격리와 `tools/vitest-helpers`
- NGINX replica failover, SSE, Restate HTTP/2, gzip·proxy buffer 튜닝
- 100% coverage와 decorator metadata 변환
- Dependabot 자동 병합
- Dev Container DooD 경로·네트워크·개발 도구 credential mount
- 기존 BFF 계약 테스트
