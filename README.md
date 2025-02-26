# NEST-SEED

NestJS 기반 프로젝트 시작을 위한 통합 템플릿으로, 다음과 같은 핵심 기능을 제공합니다:

1. **Docker 기반 개발 환경**: 컨테이너화된 완전한 개발 환경을 즉시 구성할 수 있습니다.
2. **데이터베이스 통합**: MongoDB 및 Redis에 대한 사전 구성된 설정을 포함합니다.
3. **테스트 커버리지**: 모든 코드에 Jest 기반 단위/통합 테스트 코드를 제공합니다.
4. **고성능 테스트 실행**: Jest의 병렬 실행 기능을 활용해 빠른 테스트 수행이 가능합니다.
5. **계층화 아키텍처**: 관심사 분리를 위한 3-Layer 아키텍처를 적용했습니다.
6. **MSA 지원**: NATS 메시지 브로커를 활용한 마이크로서비스 아키텍처 기반 구성이 가능합니다.
7. **E2E 테스트 자동화**: Bash 스크립트 기반의 종단 간 테스트 시스템을 구축했습니다.
8. **설계 문서화**: PlantUML로 작성된 상세 아키텍처 다이어그램을 포함합니다.

## 1. 요구사항

이 프로젝트를 실행하려면 호스트에 다음 필수 구성 요소가 설치되어 있어야 합니다:

- 16GB RAM
    - 16GB 미만이라면 jest 실행 시 --runInBand 옵션을 추가해서 메모리 사용량을 줄일 수 있습니다.
- Docker
- VSCode & extensions
    - Dev Containers (ms-vscode-remote.remote-containers) extension

> Windows 환경에서는 호환성 문제가 발생할 수 있으므로, VMware를 통해 우분투에서 VSCode를 실행하는 것을 권장합니다.

## 2. 프로젝트 이름 변경

원하는 프로젝트 이름으로 변경하려면 다음 설정을 검토하고 수정합니다:

- .env.test
- devcontainer.json
    - forwardPorts
- package.json
    - name

## 3. 개발 환경

- 호스트에서 [git credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials) 설정 후, vscode에서 Reopen container를 실행하면 개발 환경이 자동으로 구성됩니다.
- 개발 환경을 초기화 하려면 vscode의 "Dev Containers: Rebuild Container"를 실행한다.

## 4. 실행과 디버깅

- 개발 환경 실행 구성은 /.vscode/tasks.json에 정의되어 있습니다.
- 디버깅 구성은 /.vscode/launch.json에 정의되어 있습니다.
- VSCode에 "Jest Runner" extension 설치 및 code lens 옵션이 활성화 되어있다면, Jest 테스트에 대해 "Run | Debug" 메뉴가 나타납니다.
    - "Debug"를 클릭하면 디버거를 자동으로 연결하고 테스트를 실행합니다.

## 5. 테스트

- End-to-end 테스트는 bash 스크립트로 작성했습니다.
    - Run `bash test/e2e/run.sh`

## 6. 빌드

제품을 빌드하고 실행하려면 docker에 대한 지식이 필요하다.
상세 정보는 다음을 참고한다:

- Dockerfile
- docker-compose.yml

## 7. 그 외

1. 본 문서에서 다루지 않는 중요 정보는 아래 문서에 정리했다.
    - [Design Guide](./docs/guides/design.guide.md)
    - [Implementation Guide](./docs/guides/implementation.guide.md)
2. "PlantUML Preview"에서 md 파일 내 UML 다이어그램을 보려면 커서가 `@startuml`과 `@enduml` 사이에 있어야 합니다.
3. UML 다이어그램이 "Preview markdown"에서 나타나지 않으면 보안 설정이 필요할 수 있습니다.
    - 미리보기 화면 오른쪽 상단의 "..." 버튼을 클릭하여 "미리보기 보안 설정 변경"을 선택하세요.
