# NEST-SEED

NestJS 프로젝트를 시작하기 위한 템플릿으로 필수 기능과 설정을 포함하고 있습니다.

## 요구사항

이 프로젝트를 실행하려면 호스트에 다음 필수 구성 요소가 설치되어 있어야 합니다:

-   Docker
-   VSCode & extensions
    -   Dev Containers (ms-vscode-remote.remote-containers) extension

> Windows 환경은 테스트 하지 않았습니다. Windows 사용자는 VMware를 사용하여 우분투에서 VSCode를 실행하는 것을 추천합니다.

## 프로젝트 이름 변경

프로젝트 이름을 변경하려면 필요에 따라 다음 설정을 검토하고 수정합니다:

-   .env.test
-   devcontainer.json
    -   forwardPorts
-   package.json
    -   name

## 개발 환경

-   호스트에서 [git credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials) 설정 후, vscode에서 Reopen container를 실행하면 개발 환경이 자동으로 구성됩니다.
-   개발 환경을 초기화 하려면 vscode의 "Dev Containers: Rebuild Container"를 실행한다.

## 실행과 디버깅

-   개발 환경 실행 구성은 /.vscode/tasks.json에 정의되어 있습니다.
-   디버깅 구성은 /.vscode/launch.json에 정의되어 있습니다.
-   VSCode에 “Jest Runner” 및 code lens” extension이 설치되어 있는 경우, Jest 테스트에 대해 "Run | Debug" 메뉴가 나타납니다.
    -   "Debug"를 클릭하면 디버거를 자동으로 연결하고 테스트를 실행합니다.

## 테스트

-   End-to-end 테스트는 bash 스크립트로 작성했습니다.
    -   Run `bash test/e2e/run.sh`

## 빌드

제품을 빌드하고 실행하려면 docker에 대한 지식이 필요하다.
상세 정보는 다음을 참고한다:

-   Dockerfile
-   docker-compose.yml

## 그 외

본 문서에서 다루지 않는 중요 정보는 아래 문서에 정리했다.

-   [Design Guide](./docs/guides/design.guide.md)
-   [Implementation Guide](./docs/guides/implementation.guide.md)

## 이슈

-   "PlantUML Preview"에서 md 파일 내 UML 다이어그램을 보려면 커서가 `@startuml`과 `@enduml` 사이에 있어야 합니다.
-   UML 다이어그램이 "Preview markdown"에서 나타나지 않으면 보안 설정이 필요할 수 있습니다. 미리보기 화면 오른쪽 상단의 "..." 버튼을 클릭하여 "미리보기 보안 설정 변경"을 선택하세요.
-   Linux 호스트에서 jest 실행 시 "System limit for number of file watchers reached" 오류가 발생하면, 호스트에서 이 스크립트를 실행하세요:
    ```sh
    echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
    ```
-   VMWare에서 호스트를 Suspend로 일시 정지 후 재개하면 docker container의 네트워크가 동작하지 않는 문제를 발견했다. 원인은 불명이다.
