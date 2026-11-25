# 보류한 작업

## 공통화 비용이 큰 항목

- [ ] **테스트 서버 주소 공유** — 웹과 E2E는 Compose의 API 주소를 사용하고, Race와 Benchmark는 각 실행기가 NGINX 주소를 전달한다. 서비스 이름과 포트만으로 주소를 정할 수 있는 현재 구성에서는 공용 설정을 추가하는 비용이 크다. 접속 경로가 더 복잡해지면 주소를 제공할 위치를 다시 검토한다. [웹 Compose](infra/compose.apps.yml) · [E2E Compose](apps/web/tests/compose.e2e.yml) · [Race](infra/tests/api/race/runner.sh) · [Benchmark](infra/tests/api/benchmark/run.sh)
- [ ] **Race 시나리오의 CI 자동 편입** — 로컬 실행기는 파일에서 시나리오를 찾고 CI는 반복 실행할 네 개를 명시한다. 새 시나리오를 모두 CI에서 실행하기로 하면 파일 목록을 읽어 병렬 작업에 전달하는 방식을 검토한다. [로컬 실행기](infra/tests/api/race/runner.sh) · [CI 설정](.github/workflows/test-api-race.yaml)
- [ ] **Restate 배포 관리 코드 공유** — 인프라 복구 테스트는 SDK와 Node로 단독 실행한다. 공통 라이브러리와 관리 기능을 더 공유할 필요가 생기면 독립 실행과 빌드 순서에 미치는 영향을 검토한다. [복구 테스트](infra/tests/restate-journal-recovery.test.js) · [공통 라이브러리](libs/common/src/restate/restate-endpoint.ts)

## 설계 결정이 필요한 항목

- [ ] **Dev Container와 네트워크 이름 생성** — 호스트가 컨테이너 시작 전에 네트워크를 만들고, Docker 실행 인자와 컨테이너 안의 Compose도 같은 이름을 사용한다. 현재의 사용자별·폴더별 이름과 VS Code 시작 절차를 유지하면서 호스트에서 계산한 값을 각 단계에 전달할 방법을 정한다. [Dev Container 설정](.devcontainer/devcontainer.json)
- [ ] **MongoDB 노드 구성 공유** — 노드별 Compose 서비스명, Replica Set 멤버 ID와 공지 주소를 어디에 정의할지 정한다. 그 정의로 앱의 접속 URI와 초기화·진단 대상을 제공하려면 Dev Container가 최종 환경 값을 읽는 시점도 고려해야 한다. [MongoDB 초기화](infra/compose.mongo.yml) · [Race 진단](infra/tests/api/race/runner.sh) · [환경 변수 주입](README.md#환경-변수-파일-변경-후-dev-container-재생성)
