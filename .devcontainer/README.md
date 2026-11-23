# .devcontainer/ — 개발 환경

## 환경 변수 파일 변경 후 Dev Container 재생성

Dev Container는 생성할 때 루트의 `.env.infra`와 `.env.api`를 읽는다. 둘 중 하나를 수정하면 VS Code에서 **`Rebuild Container`**를 실행한다. `.env.infra`의 `API_PORT`를 바꾸면 web 개발 서버의 `API_BASE_URL`도 새 포트에 맞춘다. [웹 설정](../apps/web/.env)

Compose도 API 컨테이너를 만들 때 두 파일을 그대로 읽는다. 변수 참조와 따옴표가 값에 포함되므로 `API_PORT=3000`처럼 최종 값을 적는다. `NODE_ENV`는 개발 서버와 테스트가 각각 설정한다. [API Compose 설정](../compose.yml)

## 시작 순서와 데이터 초기화

Dev Container를 처음 만들면 VS Code가 `node` 계정에 `hunjuly/dotfiles`를 설치한다. 포크할 때는 `devcontainer.json`의 `dotfiles.repository`를 바꾸거나 제거한다.

시작할 때마다 의존성을 설치하고 개발 데이터를 삭제한 뒤 인프라를 다시 만든다. [인프라 초기화](../infra/README.md#2-인프라-시작과-데이터-초기화)
