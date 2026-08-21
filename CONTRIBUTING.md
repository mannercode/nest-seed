# 기여 안내

이 저장소의 issue와 discussion은 현재 비활성화되어 있다. 작은 수정은 pull request로 제안할 수 있고, 범위가 큰 변경은 구현을 다 마치기 전에 draft pull request로 문제와 설계를 먼저 공유한다. 제안이 반드시 병합되는 것은 아니며, 시드의 모듈 경계와 테스트 계약을 유지하는지를 우선해서 검토한다.

참여할 때는 [행동 강령](CODE_OF_CONDUCT.md)을 따른다. 보안 취약점은 pull request로 공개하지 않고 [보안 정책](SECURITY.md)의 비공개 제보 경로를 사용한다.

## 작업 환경과 신뢰 경계

공식 개발 경로는 Dev Container다. 최소 CPU 4코어, RAM 16GB, 디스크 32GB가 필요하고 전체 회귀에는 RAM 32GB 이상을 권장한다.

- Linux와 Linux 호스트 셸을 쓰는 WSL2가 기준 경로다. Windows에서는 저장소를 WSL2 파일시스템에 clone하고 Docker Desktop의 WSL integration을 켠 뒤, WSL 터미널에서 `code .`로 연다.
- Windows 네이티브 경로와 PowerShell에서 직접 여는 방식은 지원하지 않는다. `initializeCommand`와 셸 도구, 호스트와 컨테이너가 공유하는 절대 경로가 POSIX 환경을 전제로 하기 때문이다.
- macOS의 Docker Desktop은 POSIX 호스트 경로라 사용할 수 있지만 GitHub CI는 Ubuntu ARM에서만 검증한다. 호스트별 차이는 재현 정보에 적는다.
- Node나 인프라를 호스트에 직접 설치해 실행하는 경로는 지원하지 않는다.

Dev Container는 Docker Outside of Docker 방식으로 호스트 Docker daemon에 접근하고, 기본 설정에서 GitHub CLI·Codex·Claude 자격증명 경로를 bind mount한다. 따라서 외부 fork나 신뢰하지 않는 branch를 컨테이너로 열기 전에 `.devcontainer/`, npm lifecycle script와 변경 diff를 컨테이너 밖에서 먼저 검토한다. 신뢰하지 않는 코드에 Docker socket이나 개인 자격증명을 연결하지 않는다.

처음 시작할 때는 다음을 실행한다.

```bash
npm install
npm test
```

Dev Container 생성 과정이 의존성과 인프라를 준비하므로 보통 `npm ci`만 다시 실행할 필요는 없다. lockfile과 설치 재현을 확인할 때 사용하는 명령이다. 세부 부팅 과정은 [개발 환경](docs/devcontainer.md)을 본다.

## 변경 순서

버그 수정과 동작 변경은 증상을 재현하는 테스트부터 작성한다.

1. 최소 재현 테스트를 추가하고, 수정 전 코드에서 의도한 이유로 실패하는지 확인한다.
2. 구현 또는 설정을 바꿔 같은 테스트를 통과시킨다.
3. 가까운 범위의 회귀 테스트와 lint를 실행한다.
4. 사용자 계약, 운영 절차 또는 설계 판단이 달라졌다면 같은 pull request에서 문서를 갱신한다.

문서·주석·메타데이터만 바꾸는 경우에는 실패 테스트 대신 Prettier와 문서 링크 검사를 증거로 남긴다. 단순히 테스트를 건너뛰는 옵션, coverage threshold 완화, 불필요한 retry나 sleep으로 실패를 숨기지 않는다.

자주 쓰는 검증은 다음과 같다.

```bash
npm test -w apps/api -- path/to/file.spec.ts --coverage=false
npm test
npm run lint
npm run atoz
```

`npm run atoz`는 저장소가 관리하는 생성 산출물을 정리하고 전체 인프라·브라우저·배포 검증까지 실행하는 무거운 최종 게이트다. 명령의 현재 계약은 [README](README.md#개발-명령)와 [테스트 문서](docs/tests.md)를 따른다.

## 코드와 커밋 규칙

- 기존 SoLA 계층, 같은 계층 간 직접 호출 금지, ID 기반 도메인 경계를 유지한다. 설계 변경은 [apps 문서](docs/apps.md)와 [설계 결정](docs/reference/decisions.md)을 함께 갱신한다.
- 테스트 fixture는 테스트 실행 경로 가까이에 두고, 배포 스택을 외부에서 검증하는 하네스만 `tests/`에 둔다.
- 새 의존성의 install script와 라이선스를 검토한다. `allowScripts` 승인은 실제 버전으로 제한한다.
- 커밋 메시지는 Conventional Commits의 `type(scope): subject` 형식을 사용한다. 허용 type과 예시는 [컨벤션](docs/reference/conventions.md#1-커밋-메시지)에 있다.
- 저장소에 secret, 실제 사용자 데이터, 내부 URL 또는 개인 로그를 커밋하지 않는다. 실수로 secret을 올렸다면 먼저 폐기·회전한 뒤 관리자에게 비공개로 알린다.

## Pull request에 남길 증거

pull request 템플릿에 다음을 구체적으로 적는다.

- 무엇이 깨졌거나 부족했고 계약이 어떻게 달라지는지
- RED 단계의 실패 명령과 핵심 실패 메시지
- GREEN 단계와 전체 회귀에서 실행한 명령
- 환경 변수, 데이터 마이그레이션, 호환성, 배포 순서와 rollback 영향
- 문서만 바꿨다면 링크·포맷 검증 결과

자동 검사 `test-atoz`가 필수 상태 검사다. GitHub의 fork별 ruleset과 Dependabot 설정은 Git 파일만으로 복사되지 않으므로 저장소 관리자는 [GitHub 운영 설정](docs/github-setup.md)을 별도로 적용한다.
