# AI 코딩 사례 연구 — k6를 Dev Container에 설치하지 않게 되기까지

이 문서는 2026년 9월 2일 Dev Container의 도구 설치를 정리하면서 k6 실행 방식이 바뀐 과정을 강의용 사례로 다시 구성한 것이다. 목표는 최종 Docker 방식만 정답처럼 소개하는 것이 아니다. **AI 에이전트의 제안은 완성된 결론이 아니며, 그럴듯한 코드와 설명도 전제·사용 환경·검증 범위를 사람이 계속 확인해야 한다**는 점을 보여 준다. 특히 에이전트가 주어진 문제 안에서 해법만 개선하고 있을 때, 사람은 승인자에 머물지 않고 에이전트가 보지 못한 전제나 새로운 문제의 틀을 제시해야 한다.

이 사례에서 중요한 것은 누가 코드를 썼는지가 아니라 어떤 질문이 빠졌고 어떻게 교정했는지다. 그래서 채택하지 않은 GitHub `latest` 자산 탐색과 공식 APT 설치도 결과에서 지우지 않는다.

> **작성 시점의 상태:** k6는 Dev Container에 설치하지 않는다. [`deploy/compose.yml`](deploy/compose.yml)에 버전과 digest를 고정한 공식 `grafana/k6` 이미지를 두고, [`run-k6.sh`](tests/api-benchmark/run-k6.sh)가 필요할 때만 실행한다. 변경은 [PR #155](https://github.com/mannercode/nest-seed/pull/155)에 병합됐고, 최종 [ARM64 Test AtoZ](https://github.com/mannercode/nest-seed/actions/runs/33589133249)가 통과했다.

## 1. 사건 요약

검토 전 [Dev Container Dockerfile](https://github.com/mannercode/nest-seed/blob/c977800792663ad401413f9a635d13f03414309c/.devcontainer/Dockerfile#L48-L61)의 k6 설치는 GitHub Releases에서 현재 아키텍처의 최신 자산을 직접 찾는 방식이었다.

```dockerfile
RUN set -eu; \
    suffix="linux-${TARGETARCH}.tar.gz"; \
    download_url="$(curl -fsSL --retry 3 --retry-all-errors \
    https://api.github.com/repos/grafana/k6/releases/latest \
    | jq -er --arg suffix "$suffix" \
    '[.assets[].browser_download_url | select(endswith($suffix))] | if length == 1 then .[0] else error("expected exactly one matching k6 asset") end')"; \
    curl -fsSL --retry 3 --retry-all-errors "$download_url" -o /tmp/k6.tar.gz; \
    ...
```

이 코드는 아키텍처에 맞는 자산이 정확히 하나인지 확인하고 실패를 전파한다는 점에서는 방어적이다. 문제는 그런 설치기를 이 저장소가 직접 소유해야 할 이유부터 확인하지 않았다는 데 있다. GitHub API 응답, 자산 이름, 압축 구조와 `latest`가 가리키는 가변 버전까지 Dev Container 빌드가 떠안았다.

검토 과정은 다음처럼 진행됐다.

| AI 에이전트의 제안·구현                                         | 빠졌던 질문·문제                                                       | 사용자의 반문                                             | 최종 반영                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| 설치 뒤 모든 CLI의 버전을 출력했다.                             | 설치 명령의 성공과 버전 출력이 중복됐고 출력값을 판정하지도 않았다.    | “이걸 다 version 봐야 해?”                                | 의미 없는 버전 출력 명령을 모두 없앴다.                                   |
| 한 `install` 단계에서 workspace와 Playwright 브라우저를 깔았다. | 이름이 무엇을 설치하는지 말하지 못했고 서로 다른 lifecycle을 합쳤다.   | “두 개를 설치하는데 나눠야 하지 않나?”                    | workspace 의존성과 Playwright Chromium 단계를 분리하고 이름을 구체화했다. |
| GitHub API와 `jq`로 k6 최신 자산 URL을 계산했다.                | 공식 배포 통로가 있는데 자체 설치 로직부터 만들었다.                   | “왜 `download_url`을 별도로 구하지?”, “공식이 낫지 않나?” | 자체 최신 자산 탐색을 버렸다.                                             |
| 공식 k6 APT 저장소에서 패키지를 설치했다.                       | 공식 절차라는 사실만 확인하고 실제 CI 아키텍처 지원은 확인하지 않았다. | “그게 공식 안내인가?”                                     | 공식 문서와 실제 배포 대상을 따로 검증했다.                               |
| k6를 Dev Container의 상시 패키지로 유지하려 했다.               | k6가 언제, 어디서 실행되는 도구인지 먼저 따지지 않았다.                | “패키지 꼭 설치해야 하나? Docker 이미지는 없나?”          | 필요할 때만 공식 k6 컨테이너를 실행하게 바꿨다.                           |

한 번의 반문으로 완성된 답이 나온 것이 아니다. 각 답은 다음 질문의 대상이 됐고, 그 과정에서 문제의 층위가 `설치 스크립트를 어떻게 잘 쓸까`에서 `이 도구를 여기에 설치할 필요가 있는가`로 올라갔다.

## 2. 질문과 답변

### 질문 1. “설치한 도구의 버전을 전부 출력해야 하나?”

아니다. 다음처럼 설치 직후 버전을 출력하는 명령은 이 Dockerfile에서 별도 보장을 만들지 않았다.

```dockerfile
apt-get install ...; \
curl --version; \
git --version; \
jq --version; \
shellcheck --version
```

`set -e`가 적용된 build step에서는 설치가 실패하면 이미 빌드가 멈춘다. `--version`이 성공해도 실제 프로젝트 명령, 설정, 아키텍처 호환성이 맞는다는 뜻은 아니다. 출력된 버전을 기대값과 비교하지도 않으므로 로그만 늘어난다.

버전 확인이 항상 잘못인 것은 아니다. 특정 버전이 계약이라면 출력만 할 것이 아니라 정확한 기대값과 비교해야 하고, 실제 사용 가능성이 계약이라면 대표 명령을 실행해야 한다. 이 사례에서는 Node 베이스 tag·digest, pnpm의 `packageManager`, Playwright의 package manifest처럼 **버전의 근거를 선언부에 고정하는 것**이 맞았다.

### 질문 2. “`install`은 무엇을 설치한다는 뜻인가?”

초기 `postCreateCommand`는 다음 두 작업을 한 문자열로 묶었다.

```json
{
    "install": "pnpm install --frozen-lockfile && pnpm --filter './tests/web' exec playwright install chromium"
}
```

앞 명령은 workspace package 의존성을 복원하고, 뒤 명령은 그 package가 관리하는 Playwright 버전에 맞는 브라우저 실행 파일을 받는다. 실패 원인과 재실행 시점이 다른 작업이다. 최종 구성은 다음처럼 lifecycle과 이름을 분리했다.

```text
updateContentCommand.workspace-dependencies → pnpm install --frozen-lockfile
postCreateCommand.playwright-chromium       → workspace의 Playwright로 Chromium 설치
```

이 질문은 k6 방식도 다시 보게 했다. 설치 명령 하나를 줄이는 것보다 먼저 **각 도구가 어느 lifecycle에 속하는지** 알아야 했다.

### 질문 3. “왜 k6의 `download_url`을 직접 구하나?”

직접 설치가 꼭 필요하다면 아키텍처별 standalone binary를 받는 것은 가능하다. [Grafana 공식 설치 문서](https://grafana.com/docs/k6/latest/set-up/install-k6/)도 GitHub Releases의 standalone binary를 선택지로 안내한다. 그러나 위 구현은 단순한 다운로드를 넘어 다음 책임을 저장소에 들였다.

- GitHub API에서 `latest` release를 조회한다.
- Docker의 `TARGETARCH`와 release 자산 suffix가 같다고 가정한다.
- 일치하는 자산이 정확히 하나인지 `jq`로 판정한다.
- 외부 release의 압축 디렉터리 구조를 가정해 푼다.
- 가변적인 최신 버전을 checksum이나 digest 고정 없이 설치한다.

`download_url` 변수 자체가 문제인 것은 아니다. **이미 공급자가 package repository와 container image를 제공하는데도 자체 설치기를 먼저 만든 선택**이 문제였다. 코드를 견고하게 만드는 일과 그 코드를 소유할 필요가 있는지는 별개의 질문이다.

### 질문 4. “공식 APT 저장소를 쓰면 이제 맞는가?”

아직 아니다. 공식 문서는 Debian/Ubuntu에서 APT로 설치하는 방법을 안내하므로 출처와 서명 검증 면에서는 GitHub `latest` 탐색보다 자연스럽다. 당시 Dockerfile은 공식 저장소 URL과 서명 키를 사용했지만 공식 문서의 명령을 그대로 복사한 것은 아니었다. “공식 배포 경로를 사용했다”와 “구현 전체가 공식 안내와 같다”도 구분해야 한다. 그리고 공식이라는 말은 다음을 자동으로 보장하지 않는다.

- 이 저장소가 지원하는 모든 CPU 아키텍처에 package가 있다.
- 이 도구가 Dev Container에 상시 들어가야 한다.
- package 방식이 Docker 방식보다 이 실행 환경에 잘 맞는다.
- 문서의 명령을 옮긴 Dockerfile이 실제 대상 환경에서 빌드된다.

실제로 k6 APT 저장소를 적용한 커밋의 [Test AtoZ](https://github.com/mannercode/nest-seed/actions/runs/33588506729)는 `ubuntu-24.04-arm`에서 Dev Container를 만들다가 실패했다.

```text
case "arm64" in ...
Get:4 https://dl.k6.io/deb stable InRelease
Get:8 https://pkg.cloudflare.com/cloudflared any InRelease
Get:9 https://pkg.cloudflare.com/cloudflared any/main arm64 Packages
E: Unable to locate package k6
```

해당 실행에서는 k6 저장소의 `InRelease`는 받았지만 ARM64용 `Packages` index는 내려오지 않았고 설치할 `k6`를 찾지 못했다. 반면 같은 step의 cloudflared 저장소는 ARM64 package index를 제공했다. APT 문법이나 네트워크가 모두 실패한 것이 아니라 **공식 배포 경로와 이 저장소의 대상 아키텍처가 맞지 않았던 것**이다.

구성 계약 테스트도 당시 Dockerfile에 공식 APT URL이 있고 GitHub API URL이 없다는 것은 확인했다. 그러나 정규식은 외부 저장소에 ARM64 package가 존재하는지 증명하지 못한다. 잘못된 전제도 테스트로 고정할 수 있다는 사례다.

### 질문 5. “그런데 k6 package를 꼭 설치해야 하나?”

필요하지 않았다. 이 질문이 설치 방법이 아니라 배치 자체를 바꿨다.

k6의 실제 사용 범위를 추적하면 다음과 같았다.

- [`tests/api-benchmark`](tests/api-benchmark)의 성능 하네스에서만 실행한다.
- 평소의 편집, build, lint, unit test와 애플리케이션 개발에는 필요하지 않다.
- benchmark runner는 이미 Docker Compose로 API 4개와 NGINX를 띄운다.
- k6는 외부 host 주소보다 같은 deploy network의 `http://nginx`를 호출하는 편이 실행 경계가 분명하다.

즉 모든 개발자가 쓰는 장기 생존 Dev Container에 넣기보다, benchmark 실행 때 생겼다가 사라지는 sibling container가 도구의 lifecycle과 맞았다. k6를 빼면 Dev Container rebuild가 k6 package repository의 가용성에 묶이지 않고 이미지에도 불필요한 binary가 남지 않는다.

이 판단은 “Docker 이미지가 있으니 Docker를 쓴다”가 아니다. **이미 benchmark가 Docker와 deploy network를 전제로 하고, k6도 그 한 시나리오에서만 필요한 실행기였기 때문**이다.

### 질문 6. “Docker 실행이 package 직접 설치보다 항상 좋은가?”

아니다. 이 저장소의 k6에는 Docker가 더 맞았을 뿐이다.

| 기준             | Dev Container에 직접 설치                                  | 필요할 때 Docker로 실행                                          |
| ---------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| 시작 비용        | 이미지에 이미 있으면 즉시 실행                             | 최초 image pull과 container 시작이 필요                          |
| 개발 이미지      | 모든 rebuild와 개발자 환경에 k6가 포함                     | benchmark를 실행하지 않으면 k6 image가 필요 없음                 |
| 아키텍처         | package repository가 대상 package를 제공해야 함            | 선택한 multi-platform image가 대상 manifest를 제공해야 함        |
| 네트워크         | Dev Container에서 deploy network에 직접 접근               | sibling container를 같은 deploy network에 연결해야 함            |
| 파일·권한        | workspace 파일과 현재 사용자 권한을 그대로 사용            | bind mount와 UID:GID 전달이 필요                                 |
| 버전 관리        | package repository와 설치 시점에 의존하거나 별도 고정 필요 | image tag와 digest를 Compose에 명시하고 Dependabot으로 갱신 가능 |
| Docker 없는 실행 | 가능                                                       | 불가능                                                           |

k6를 터미널에서 수시로 대화형 사용하거나 Docker 없이 실행해야 했다면 직접 package나 standalone binary가 더 단순할 수 있다. 반대로 이 benchmark는 이미 Docker 없이는 실행되지 않으므로 Docker 의존성이 새로 생기지 않았다.

### 질문 7. “최종 Docker 방식은 공식 안내인가?”

공식 문서는 k6의 Linux package와 standalone binary뿐 아니라 다음 Docker image도 별도 설치 선택지로 명시한다.

```bash
docker pull grafana/k6
```

따라서 `grafana/k6` image를 직접 실행하는 것은 공식 배포 경로다. 다만 Compose profile, workspace mount, UID/GID, 환경 변수 전달을 조합한 [`run-k6.sh`](tests/api-benchmark/run-k6.sh)는 이 저장소의 실행 조건에 맞춘 설계다. **공식 image를 사용한다는 사실과 저장소의 wrapper 전체가 공급자의 공식 권장안이라는 주장은 구분해야 한다.**

최종 실행 경로는 다음과 같다.

```text
runner.sh / mixed-runner.sh
└─ run-k6.sh
   └─ docker compose run --rm --no-deps k6 ...
      ├─ 공식 grafana/k6:2.2.0 image
      ├─ deploy network → http://nginx
      ├─ workspace bind mount → harness와 결과 파일
      └─ 현재 UID:GID → host workspace 권한 유지
```

image는 tag만 쓰지 않고 다음 multi-platform index digest까지 고정했다.

```text
grafana/k6:2.2.0@sha256:9bd01d6941fca969cb61bb57d2da5ee9b385fe2aa8881df3798c196564d6ace6
├─ linux/amd64
└─ linux/arm64
```

Docker 방식에도 wrapper, network, mount, 권한 전달이라는 복잡성이 있다. 다만 이 복잡성은 benchmark 경계 안에만 있고, 기존 deploy Compose 문맥을 그대로 사용한다. 직접 설치 방식의 복잡성은 모든 Dev Container build에 전파됐다. 어느 복잡성을 어디에 둘 것인지 비교한 결과다.

### 질문 8. “그럼 다른 도구도 전부 Docker로 옮겨야 하나?”

그렇지 않다. k6 사례를 “CLI는 모두 container로 실행한다”는 규칙으로 일반화하면 같은 실수를 반복한다.

- pnpm, Git, shellcheck처럼 개발 루프에서 자주 호출하는 도구는 Dev Container 안에 있는 편이 자연스럽다.
- Playwright는 workspace package 버전, VS Code의 대화형 실행과 browser cache가 맞물려 있어 현재는 workspace와 Dev Container lifecycle에 두는 편이 단순하다.
- cloudflared는 사용자가 선택적으로 실행해 Dev Container의 `localhost` 앱을 바로 tunnel하므로 직접 CLI가 현재 경계와 맞는다.
- PlantUML처럼 장기 실행되는 독립 server는 Docker 호스트에서 하나를 공유할 수 있다. 이 저장소는 전용 Compose에 공식 server image·고정 이름·restart 정책·공유 네트워크를 선언하고, 모든 Dev Container를 그 네트워크에 붙인다. remote extension host에서 동작하는 PlantUML 전용 Preview에는 이 경로만으로 충분하다. local machine의 Markdown webview까지 지원하려고 port forwarding과 relay를 추가하면 한 기능에 두 접근 경로가 생기므로 지원 범위에서 제외했다. Docker로 옮긴다는 결정 뒤에도 실제 소비자가 어디서 실행되는지 확인하고 범위를 정해야 한다.

도구마다 `공식 image가 있는가`보다 **누가, 언제, 어느 네트워크와 파일을 사용해 실행하는가**를 먼저 본다.

### 질문 9. “무엇을 확인해야 완료라고 할 수 있나?”

최종 변경에서는 서로 다른 층을 따로 검증했다.

1. `pnpm run test:config`의 22개 테스트로 k6가 Dev Container에서 빠지고, Compose image가 tag+digest로 고정되며, 두 benchmark runner가 wrapper를 사용하는지 확인했다.
2. `shellcheck`로 새 wrapper와 기존 runner의 shell 문법·일반 오류를 확인했다.
3. `docker compose --project-directory deploy config --quiet`으로 Compose 구성을 해석했다.
4. `bash tests/api-benchmark/run-k6.sh version`으로 실제 image pull·container 실행·자동 제거 경로를 확인했다.
5. `docker buildx imagetools inspect`로 고정한 image index에 `linux/amd64`와 `linux/arm64` manifest가 모두 있는지 확인했다.
6. AMD64에서 Dev Container를 실제 build했다.
7. 앞서 실패했던 ARM64 GitHub runner에서 전체 Test AtoZ를 통과시켰다.

여기서도 주장 범위를 지켜야 한다. 위 증거는 설치와 실행 경계, 두 아키텍처의 Dev Container build 회귀를 검증한다. k6 부하 수치의 재현성이나 성능 결과 자체를 증명하는 것은 별도의 benchmark 반복 실행이다.

## 3. 이 사례에서 배우는 AI 코딩 원칙

### AI 에이전트에는 사람이 대신 맡길 수 없는 한계가 있다

AI 에이전트는 코드, 문서와 실행 결과를 넓게 탐색하고 여러 대안을 빠르게 만들 수 있다. 새로운 관점을 전혀 만들지 못하는 도구도 아니다. 그러나 다음 한계 때문에 그 제안을 그대로 의사결정으로 받아들이면 안 된다.

- 에이전트는 주어진 요청과 현재 대화에서 드러난 맥락을 바탕으로 답한다. 사용자가 말하지 않은 운영 목적, 팀의 우선순위와 감수할 비용까지 실제로 아는 것은 아니다.
- 현재 문제의 틀을 전제로 다음 구현을 만드는 데 능숙한 만큼, 그 틀 자체가 틀렸다는 질문을 놓치고 국소 최적화를 계속할 수 있다.
- 자연스럽고 단정적인 설명은 정확도나 검증 수준을 그대로 나타내지 않는다. 확인한 사실과 그럴듯하게 이어 붙인 추론이 같은 확신으로 표현될 수 있다.
- 도구를 사용해 검증하더라도 관측한 환경과 실행 범위 밖까지 자동으로 보장하지 않는다. AMD64의 성공이나 정규식 계약 테스트로 ARM64 package 제공 여부를 증명할 수 없었던 것과 같다.
- 에이전트는 선택의 유지 비용과 실패 결과를 실제로 부담하지 않는다. 따라서 프로젝트의 최종 판단과 책임까지 위임할 수 없다.

그래서 사람의 역할은 AI가 만든 결과를 마지막에 승인하는 데 그치지 않는다. 사람은 프로젝트의 목적과 암묵적 맥락을 제공하고, 빠진 전제를 찾고, 필요하면 에이전트가 보지 못한 관점으로 문제를 다시 정의해야 한다. 이 사례에서 그 새로운 관점은 별도의 기술 해법이 아니라 다음 한 문장이었다.

> “그런데 package를 꼭 설치해야 하나?”

이 질문은 `GitHub Releases와 APT 중 무엇으로 설치할까`라는 선택지를 `Dev Container에 상시 설치할 이유가 있는가`라는 상위 문제로 바꿨다. 에이전트가 더 정교한 설치 코드를 제시하는 것만으로는 나오지 않았던 전환이다.

그렇다고 사람이 매번 정답이나 독창적인 대안을 미리 알고 있어야 한다는 뜻은 아니다. “왜 필요한가?”, “반대 선택은 무엇인가?”, “어느 환경에서 확인했나?”처럼 현재 틀을 흔드는 질문만으로도 충분할 수 있다. **AI도 새로운 시각을 제안할 수 있지만, 놓친 시각이 없는지 능동적으로 의심하고 최종 판단을 내리는 역할은 사람이 유지해야 한다.**

### AI의 첫 답은 결론이 아니라 검토할 가설이다

AI 에이전트는 문법적으로 완성된 코드와 자연스러운 이유를 빠르게 제시한다. 그래서 아직 확인하지 않은 전제도 이미 검증된 사실처럼 보이기 쉽다. 이 사례에서는 GitHub 자산 탐색도, 공식 APT 전환도 각각 그럴듯했지만 최종 배치 판단은 아니었다.

제안의 유창함, 코드의 길이, 방어 로직의 수는 적합성의 증거가 아니다.

### “어떻게 설치할까?” 전에 “왜 설치해야 하나?”를 묻는다

처음에는 다운로드 URL을 더 안전하게 구하고 package repository를 더 공식적으로 등록하는 데 집중했다. 하지만 가장 큰 단순화는 설치기를 개선해서가 아니라 Dev Container에서 k6 설치 자체를 없애서 나왔다.

구현 세부를 검토할 때도 한 단계 위 질문을 반복한다.

```text
이 명령이 필요한가?
└─ 이 도구를 설치해야 하는가?
   └─ 이 환경에 상시 설치해야 하는가?
      └─ 이미 있는 실행 경계에서 일회성으로 쓸 수 없는가?
```

### “공식”과 “현재 환경에 적합”을 구분한다

공식 문서는 신뢰할 출발점이지만 프로젝트의 OS, CPU, lifecycle, network와 운영 비용까지 대신 판단하지 않는다. 공식 APT 저장소가 존재해도 당시 ARM64 package가 없었고, 공식 문서는 Docker와 standalone binary도 함께 제시했다.

공식 경로를 찾은 뒤에는 그중 어떤 선택지가 현재 대상에 맞는지 다시 검증해야 한다.

### 정적 계약 테스트는 외부 현실을 대신하지 못한다

APT URL을 정규식으로 확인하는 테스트는 오타와 임의 GitHub 다운로드의 재도입을 막을 수 있다. 하지만 repository가 특정 아키텍처의 package를 실제 제공하는지는 확인하지 못한다. 테스트가 통과했다는 말은 **그 테스트가 관측한 계약만** 통과했다는 뜻이다.

외부 registry, package repository, CPU architecture가 관련되면 실제 대상에서 build하거나 해당 manifest를 조회해야 한다.

### 사용자의 반문은 단순한 취향이 아니라 검증 단계다

이 사례의 방향을 바꾼 질문은 짧았다.

- “이 버전 출력들이 필요한가?” — 실행 성공과 장식용 로그를 구분하게 했다.
- “`install`은 무엇을 설치하나?” — 서로 다른 lifecycle이 한 단계에 숨은 것을 드러냈다.
- “왜 다운로드 URL을 직접 구하나?” — 자체 설치기를 소유할 필요를 묻게 했다.
- “그게 공식 안내인가?” — 출처를 확인하게 했다.
- “package를 꼭 설치해야 하나?” — 방법이 아니라 전제를 되돌렸다.
- “Docker가 더 좋은가?” — 최종안도 조건부 선택임을 설명하게 했다.

AI와의 좋은 협업은 제안을 빨리 승인하는 과정이 아니다. 사용자가 구체적인 불편과 의문을 말하고, AI가 코드·공식 문서·실행 로그로 답을 다시 좁히며, 실제 대상 환경이 마지막 판정을 하게 하는 과정이다.

### 실패한 제안을 기록하되 책임 공방으로 만들지 않는다

중간 실패를 지우면 “처음부터 Docker가 명백했다”는 잘못된 이야기가 된다. 반대로 누가 잘못했는지만 남기면 다음 검토에 쓸 원칙이 사라진다. 사례 문서는 다음을 구분해 기록한다.

| 구분      | 이 사건의 예                                                             |
| --------- | ------------------------------------------------------------------------ |
| 관찰      | ARM64 Dev Container build에서 `Unable to locate package k6`가 발생했다.  |
| 코드 사실 | k6는 benchmark runner에서만 쓰이고 deploy stack은 이미 Compose를 쓴다.   |
| 제안      | 공식 APT package로 Dev Container에 설치한다.                             |
| 반증      | 해당 CI 아키텍처에서 package를 찾을 수 없고 상시 설치할 필요도 없었다.   |
| 최종 선택 | 공식 multi-platform image를 benchmark 때만 sibling container로 실행한다. |
| 남은 비용 | image pull, wrapper, network·mount·권한 연결을 유지해야 한다.            |

## 4. AI 제안을 수용하기 전 확인표

도구 설치나 실행 방식을 AI가 제안했다면 최소한 다음을 확인한다.

1. 이 도구는 저장소의 어디에서 실제로 사용되는가?
2. 모든 개발자가 상시 필요로 하는가, 특정 작업에서만 필요한가?
3. package, standalone binary, container 중 공급자가 제공하는 공식 경로는 무엇인가?
4. 지원할 OS와 CPU 아키텍처마다 실제 artifact가 있는가?
5. 버전은 어디에 고정되고 누가 갱신하는가?
6. 새 로직이 외부 API, 자산 이름, 압축 구조처럼 불필요한 책임을 떠안지는 않는가?
7. 정적 설정 검사 외에 실제 대상 환경에서 실행해 봤는가?
8. 최종안이 없앤 복잡성과 새로 만든 복잡성을 모두 설명할 수 있는가?
9. 검증한 범위보다 넓게 “문제없다”라고 주장하고 있지는 않은가?

이 확인표의 목적은 AI를 불신해 쓰지 않는 것이 아니다. AI가 빠르게 만든 후보를 사람이 무비판적으로 채택하지 않고, 에이전트가 놓친 시각을 사람이 보충하며, 반문과 실행 증거를 통해 프로젝트에 맞는 결정으로 바꾸는 데 있다.
