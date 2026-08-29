# GitHub 운영 설정

`.github/`의 workflow와 Dependabot 파일은 fork에 복사되지만, 저장소 Settings의 ruleset, Actions 변수·secret, auto-merge, 보안 기능은 복사되지 않는다. 새 프로젝트 관리자는 이 문서를 한 번 끝까지 적용해야 한다.

## 원본 저장소의 운영 계약

원본 `mannercode/nest-seed`는 다음 계약으로 운영한다. GitHub UI 상태는 Git 기록과 독립적으로 바뀔 수 있으므로 아래 확인 명령의 결과를 최종 기준으로 삼는다.

| 항목                        | 원본 상태와 의도                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| 공개 범위                   | public. issue·wiki·discussion은 비활성화                                                           |
| main ruleset                | active. 기본 branch에 `test-atoz` 상태 검사 필수, repository admin은 bypass 가능                   |
| auto-merge                  | 허용. Dependabot PR에 squash auto-merge를 예약                                                     |
| branch 정리                 | merge 뒤 head branch 자동 삭제                                                                     |
| Dependabot security updates | 활성화                                                                                             |
| private vulnerability       | 활성화. 공개 issue 대신 Security advisory로 제보                                                   |
| secret scanning             | 활성화. push protection은 원본에서 아직 비활성화 상태이며, 새 저장소에는 함께 활성화하는 것을 권장 |

현재 값을 읽기만 하는 확인 명령은 다음과 같다. `OWNER/REPO`를 대상 저장소로 바꾼다.

```bash
gh repo view OWNER/REPO \
    --json visibility,hasIssuesEnabled,hasWikiEnabled,hasDiscussionsEnabled,deleteBranchOnMerge
gh api repos/OWNER/REPO --jq '{allow_auto_merge,delete_branch_on_merge,security_and_analysis}'
gh api repos/OWNER/REPO/rulesets
gh api repos/OWNER/REPO/private-vulnerability-reporting
gh api repos/OWNER/REPO/automated-security-fixes
```

## 1. Actions와 정기 실행 opt-in

fork에서는 workflow를 활성화하기 전에 파일과 비용을 검토한다. GitHub가 fork의 Actions를 처음에는 비활성 상태로 둘 수 있으므로, Settings → Actions → General의 정책과 각 workflow의 활성 상태를 확인한다.

원본 `mannercode/nest-seed`의 두 정기 실행은 바뀌지 않는 GitHub repository ID로 식별되어 별도 변수 없이 활성화된다. 저장소 이름을 바꿔도 이 ID는 fork에 복사되지 않는다. fork에서는 비용을 모르고 cron이 시작되지 않도록 repository variable이 정확히 다음 값일 때만 실제 job을 실행한다.

```text
ENABLE_SCHEDULED_CI=true
```

Settings → Secrets and variables → Actions → Variables에서 추가한다. fork에서 값이 없거나 `true`가 아니면 cron event는 job을 건너뛴다. 이 opt-in은 다음 실행에는 영향을 주지 않는다.

- `test-atoz`: pull request, main push, 수동 `workflow_dispatch`는 항상 실행
- `test-stability`: 수동 `workflow_dispatch`는 항상 실행

정기 실행량은 작지 않다.

- `test-atoz`는 UTC 기준 3시간마다 실행되며 한 회 timeout은 60분이다.
- `test-stability`는 UTC 기준 6시간마다 13개 matrix job을 실행한다. 설정된 timeout 합은 한 회 최대 49 runner-hours다.

실제 실행 시간과 과금은 GitHub 요금제·runner 정책에 따라 달라진다. 먼저 수동 실행으로 시간과 필요 자원을 확인한 뒤 opt-in하고, Actions usage와 실패 알림을 지속해서 본다. 정기 soak가 필요 없는 fork는 변수를 만들지 않는다.

## 2. Docker Hub secret

`test-stability`는 공개 이미지 pull rate limit을 완화하기 위해 호스트와 Dev Container 양쪽에서 Docker Hub에 로그인한다. 수동 실행과 opt-in 정기 실행 전에 다음 repository secrets를 만든다.

| secret               | 값                                                           |
| -------------------- | ------------------------------------------------------------ |
| `DOCKERHUB_USERNAME` | 전용 CI 계정 이름                                            |
| `DOCKERHUB_TOKEN`    | 공개 이미지 pull에 필요한 최소 read 권한만 가진 access token |

개인 주계정 비밀번호를 사용하지 않고, token은 repository variable이나 파일에 넣지 않는다. secret을 교체할 때는 Docker Hub에서 이전 token을 먼저 폐기하고 GitHub 값을 갱신한다. 두 값이 없으면 `test-stability`의 Docker login 단계가 실패하는 것이 정상이다. `test-atoz`에는 이 secret이 필요 없다.

## 3. main ruleset

Settings → Rules → Rulesets에서 branch ruleset을 만들고 다음을 설정한다.

1. Enforcement status를 Active로 둔다.
2. 기본 branch(`main`)를 대상으로 한다.
3. Require status checks to pass에 `test-atoz`를 추가한다.
4. 관리자 bypass는 팀의 긴급 변경 정책에 맞춰 결정한다. 원본은 Repository admin role의 always bypass를 사용한다.

`.github/workflows/dependabot-auto-merge.yaml`은 `gh pr merge --auto --squash`로 자동 병합을 예약한다. 필수 상태 검사 ruleset이 없으면 검사를 기다리는 보호 장치가 사라질 수 있으므로 auto-merge보다 ruleset을 먼저 만든다.

저장소 옵션도 활성화한다.

```bash
gh api -X PATCH repos/OWNER/REPO \
    -F allow_auto_merge=true \
    -F delete_branch_on_merge=true
```

조직 정책이 Actions의 write 권한을 제한하면 Dependabot auto-merge job이 실패할 수 있다. workflow의 `contents: write`, `pull-requests: write`가 조직 정책에서 허용되는지 확인한다.

## 4. Dependabot과 보안 기능

`.github/dependabot.yml`은 pnpm이 관리하는 registry 패키지를 Dependabot의 `npm` ecosystem으로 지정하고, GitHub Actions와 추적 가능한 Dockerfile/Compose 이미지 참조까지 minor/patch를 매주 확인한다. 패키지 routine update는 manifest의 직접 의존성만 대상으로 하고 AWS SDK, Next, NestJS, Restate, React, ESLint, commitlint처럼 같은 release train을 따르는 계열만 묶는다. 그 밖의 패키지는 개별 PR로 유지해 무관한 변경 하나가 전체 갱신을 막지 않게 한다. 같은 이미지를 여러 디렉터리에서 쓰면 dependency name으로 묶어 한 PR에서 갱신하고, Elasticsearch·Kibana·Filebeat는 같은 Stack 버전을 유지하도록 별도 그룹으로 함께 갱신한다. routine major update는 생성하지 않는다. TypeScript와 ESLint 생태계, Node 이미지와 OS 패키지처럼 major에서 함께 바뀌어야 하는 범위는 관리자가 한 PR에서 올려 AtoZ로 검증한다. 이 제한은 security update에는 적용되지 않으므로 major 보안 수정도 PR로 열리며 자동 머지하지 않는다. `.env.infra` 변수로 간접 참조한 Restate 등 이미지 digest는 자동 갱신 범위가 아니므로 인프라 이미지 갱신 시 수동으로 맞춘다. install script 허용 목록은 정확한 패키지 버전별 보안 경계이므로 새 버전이 들어오면 스크립트와 lockfile integrity를 검토한 뒤 명시적으로 갱신한다. 파일이 있다고 다음 저장소 설정까지 자동으로 켜지는 것은 아니다.

- Settings → Code security에서 Dependabot alerts와 Dependabot security updates를 활성화한다.
- Automated security fixes를 활성화한다.
- Secret scanning과 push protection을 활성화한다. 원본은 secret scanning만 활성화되어 있으므로 push protection 추가를 권장한다.
- Private vulnerability reporting을 활성화한다.

일부 설정은 CLI로 적용할 수 있다.

```bash
gh api -X PUT repos/OWNER/REPO/automated-security-fixes
gh api -X PUT repos/OWNER/REPO/private-vulnerability-reporting
```

권한이나 GitHub 요금제 때문에 명령이 거절되면 조직 관리자와 Security 설정을 확인한다. 기능이 켜졌다고 가정하지 말고 이 문서 첫 절의 읽기 명령으로 다시 확인한다.

## 5. secret 회전과 신뢰 경계

`.env.api`와 `.env.infra`는 공개 개발 fixture다. fork를 외부에 노출하거나 배포하기 전에 최소한 다음 값을 새로 만든다.

- 모든 `AUTH_*_SECRET`, `ROOT_PASSWORD`
- `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- 프로젝트 식별자와 외부 서비스 자격증명

운영 값은 커밋된 env 파일을 수정해 보관하지 않고 배포 환경의 secret manager에서 주입한다. 한 번 Git에 들어간 실제 secret은 파일을 고쳐도 유출 상태이므로 제공자에서 먼저 폐기·회전한다.

Dev Container는 호스트 Docker daemon을 연결하며 기본 설정에서 GitHub CLI, Codex, Claude 자격증명 경로를 bind mount한다. 이런 권한을 연결한 환경에서는 신뢰한 revision만 열고, 외부 pull request는 컨테이너를 시작하기 전에 `.devcontainer/`, 의존성 lifecycle script와 diff를 먼저 검토한다.

`tools/dev-tools/tunnel.sh`는 direct API 공개를 지원하지 않는다. 하지만 앱 BFF는 일부 auth endpoint만 막는 catch-all proxy라서, 앱 터널도 대부분의 API surface를 함께 공개한다. BFF는 API 방화벽이나 route allowlist가 아니며 최종 권한 경계는 backend guard다. 격리된 일회성 환경에서만 `TUNNEL_EXPOSE_APPS=true`와 `TUNNEL_ACKNOWLEDGE_PUBLIC_DEV_STACK_RISK=true`를 함께 설정하고, 실제 데이터·운영 secret을 넣지 않는다. 공유 환경에는 Quick Tunnel 대신 인증된 ingress(예: 접근 제어가 걸린 터널)를 사용한다. 작업 뒤 tunnel을 종료하고 사용한 임시 자격증명을 회전한다.

## 6. fork 완료 확인

다음 순서로 마무리한다.

1. 저장소 이름·패키지 scope·환경 식별자를 [환경 변수 체크리스트](reference/environment.md#4-포크할-때-확인할-값)에 따라 바꾼다.
2. 개발용 secret을 회전하고 운영 secret 주입 경로를 만든다.
3. main ruleset, auto-merge, branch 자동 삭제와 보안 기능을 설정한다.
4. `DOCKERHUB_*` secrets를 추가하고 `test-stability`를 수동 실행한다.
5. `test-atoz` 수동 실행과 pull request 검사를 확인한다.
6. 필요성과 runner 사용량을 확인한 뒤에만 `ENABLE_SCHEDULED_CI=true`를 설정한다.
7. 이 문서의 읽기 명령으로 GitHub UI 설정을 다시 검증한다.
