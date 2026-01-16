# NEST-MSA

Nest(NestJS) 기반의 MSA(Microservices Architecture) 예제 프로젝트로 주요 특징은 다음과 같습니다:

- Docker 기반 개발/테스트 환경: Dev Container와 Docker Compose를 함께 사용합니다.
- 통합 인프라: MongoDB(Replica Set), Redis, NATS, MinIO를 기본 포함합니다.
- 테스트 자동화: Jest 단위/통합 + 커버리지, Bash 기반 E2E 스위트 제공.
- 계층화 아키텍처: gateway → applications → cores → infrastructures의 일방향 의존 구조를 적용했습니다.
- MSA 지원: NATS 메시지 브로커 기반의 서비스 간 통신을 지원합니다.
- 앱 엔트리 분리: 서비스별 `development.ts`/`production.ts`/`main.ts`로 실행 진입점을 나눴습니다.

## 1. 시스템 요구 사항

이 프로젝트를 실행하려면 다음과 같은 호스트 환경이 필요합니다:

- **CPU**: 4코어 이상
- **메모리**: 16GB 이상 권장
    - 16GB 미만이면 `npm test -- --runInBand` 또는 `npm test -- --maxWorkers=2`로 실행하세요.
- **Docker 및 Docker Compose v2**
- **Node.js 24.x** (Dev Container에서 자동 제공)
- **VS Code 및 확장 프로그램**
    - Dev Containers (ms-vscode-remote.remote-containers)

> Windows 환경은 호환성 이슈가 발생할 수 있으므로, VMware로 Ubuntu를 실행한 후 그 안에서 VSCode를 사용하는 방식을 권장합니다.

## 2. 환경 파일 및 프로젝트 이름

- `.env`: 애플리케이션/테스트 공용 설정(프로젝트 ID, 포트, Mongo/Redis/NATS/MinIO 접속 정보, 로그 설정 등). 기본값은 `host.docker.internal`을 바라보도록 되어 있으므로 다른 네트워크라면 호스트 IP를 맞춰 주세요.
- `.env.infra`: 로컬 인프라와 Jest Testcontainers에서 사용할 이미지 태그를 정의합니다.
    ```env
    MONGO_IMAGE=mongo:8.2.3
    REDIS_IMAGE=redis:8.4-alpine
    NATS_IMAGE=nats:2.12-alpine
    MINIO_IMAGE=minio/minio:latest
    ```
- 프로젝트 이름 변경
    - `.env`의 `PROJECT_ID`
    - `package.json`의 `name`

## 3. 빠른 시작

1. 의존성 설치
    ```sh
    npm ci
    ```
2. 로컬 인프라 실행 (MongoDB Replica Set, Redis, NATS, MinIO)

    ```sh
    npm run infra:reset
    ```

    - `infra/local/compose.yml`을 사용하며 `.env`와 `.env.infra`를 함께 읽습니다.

3. 유닛/통합 테스트 실행

    ```sh
    # 전체
    npm test

    # 특정 경로만
    TEST_ROOT=src/apps npm test

    # 리소스가 부족하면
    npm test -- --runInBand
    ```

    - Docker가 실행 중이어야 하며 `.env.infra`의 이미지 태그로 Testcontainers가 기동됩니다.

4. E2E 테스트 실행

    ```sh
    WORKSPACE_ROOT=$(pwd) npm run test:e2e
    ```

    - `curl`, `jq`가 필요합니다.
    - `WORKSPACE_ROOT`가 필요하며 Dev Container에서는 자동 설정됩니다.
    - 각 스위트마다 `npm run infra:reset`과 `npm run apps:reset`으로 인프라/애플리케이션을 초기화합니다.
    - 기본 호출 대상은 `http://host.docker.internal:${HTTP_PORT}`(기본 3000) 입니다.

5. 종료
    ```sh
    npm run apps:down
    npm run infra:down
    ```

## 4. 서비스 실행 및 디버깅

- Docker Compose로 전체 애플리케이션 빌드/실행: `npm run apps:up` 또는 `npm run apps:reset` (`compose.yml` 사용).
- 전체 서비스가 준비될 때까지 대기: `npm run apps:wait`.
- 단일 서비스 디버깅(핫 리로드): `TARGET_APP=gateway npm run debug` (`TARGET_APP`은 `gateway`, `applications`, `cores`, `infrastructures` 중 선택).
- 빌드 후 실행: `TARGET_APP=gateway npm run build` → `TARGET_APP=gateway npm run start`.
- `TARGET_APP`은 `nest-cli.json`의 프로젝트 키와 일치해야 합니다.
- VS Code `Debug App` 구성에서 위 `TARGET_APP`을 선택해 바로 디버깅할 수 있습니다.

## 5. 개발 환경(Dev Container)

1. 호스트에서 [Git credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials)를 설정합니다.
2. VSCode에서 "Reopen in Container" 명령을 실행합니다.
3. Dev Container는 `.devcontainer/Dockerfile`(베이스 `node:24-bookworm`)을 사용하며, `postCreateCommand`/`postStartCommand`로 `npm ci` 및 `npm run infra:reset`을 자동 실행합니다.
4. Dev Container는 `WORKSPACE_ROOT`를 자동 설정하므로 E2E 스크립트를 바로 실행할 수 있습니다.

## 6. 프로젝트 구조

```text
src
├── apps
│   ├── gateway
│   │   ├── controllers           # REST API 진입점
│   │   └── modules
│   ├── applications
│   │   ├── services              # 유스케이스
│   │   │   ├── booking
│   │   │   ├── movie-drafts
│   │   │   ├── purchase
│   │   │   ├── recommendation
│   │   │   └── showtime-creation
│   │   └── modules
│   ├── cores
│   │   ├── services              # 도메인 로직
│   │   │   ├── customers
│   │   │   ├── movies
│   │   │   ├── purchase-records
│   │   │   ├── showtimes
│   │   │   ├── theaters
│   │   │   ├── ticket-holding
│   │   │   ├── tickets
│   │   │   └── watch-records
│   │   └── modules
│   ├── infrastructures
│   │   ├── services              # 외부 연동
│   │   │   ├── assets
│   │   │   └── payments
│   │   └── modules
│   ├── __tests__                 # 통합 테스트
│   └── shared                    # 공통 코드
│       ├── config
│       ├── modules
│       └── pipes
└── libs
    ├── common
    └── testlib
```

## 7. 설계 문서

설계 문서는 `PlantUML`을 사용해 작성되었으며, `docs/ko/designs` 경로에 있습니다.

- VSCode 확장: `PlantUML (jebbs.plantuml)` 설치 필요
- 미리보기 시 커서가 `@startuml`과 `@enduml` 사이에 있어야 합니다
- 보안 설정이 필요한 경우: 우측 상단 `...` → `미리보기 보안 설정 변경`

예시:

<img src="./docs/images/design-sample.png" alt="PlantUML로 작성한 문서" width="1061"/>

## 8. 추가 문서

이 프로젝트의 구현 및 설계에 대한 자세한 사항은 아래 문서를 참고하세요:

- 가이드 문서
    - [본질 기반 해석](https://mannercode.com/2024/05/04/ebi.html)
    - [설계 가이드](./docs/ko/guides/design.guide.md)
    - [구현 가이드](./docs/ko/guides/implementation.guide.md)
- 설계 문서
    - [유스케이스](./docs/ko/designs/use-cases.md)
    - [엔티티](./docs/ko/designs/entities.md)
    - [상영시간 생성](./docs/ko/designs/showtime-creation.md)
    - [티켓 구매](./docs/ko/designs/tickets-purchase.md)
