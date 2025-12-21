# NEST-MSA

Nest(NestJS) 기반의 MSA(Microservices Architecture) 예제 프로젝트로 주요 특징은 다음과 같습니다:

- Docker 기반 개발/테스트 환경: Dev Container와 Docker Compose를 함께 사용합니다.
- 데이터 및 메시징 통합: MongoDB(Replica Set), Redis, NATS, MinIO를 기본 포함합니다.
- 테스트 자동화: Jest로 단위/통합 테스트 및 커버리지 수집, Bash 기반 E2E 스위트 제공.
- 테스트 성능 도구: 병렬 실행 설정과 반복 실행 가이드 제공.
- 계층화 아키텍처: 관심사를 분리한 3계층 구조를 적용했습니다.
- MSA 지원: NATS 메시지 브로커 기반의 마이크로서비스 아키텍처를 지원합니다.
- 설계 문서 제공: PlantUML로 작성된 아키텍처 다이어그램을 제공합니다.

## 1. 시스템 요구 사항

이 프로젝트를 실행하려면 다음과 같은 호스트 환경이 필요합니다:

- **CPU**: 4코어 이상
- **메모리**: 16GB 이상 권장
    - 16GB 미만이면 `npm test -- --runInBand` 또는 `jest.config.ts`의 `maxWorkers`, `testTimeout` 값을 낮춰 실행하세요.
- **Docker 및 Docker Compose v2**
- **Node.js 24.x** (Dev Container에서 자동 제공)
- **VS Code 및 확장 프로그램**
    - Dev Containers (ms-vscode-remote.remote-containers)

> Windows 환경은 호환성 이슈가 발생할 수 있으므로, VMware로 Ubuntu를 실행한 후 그 안에서 VSCode를 사용하는 방식을 권장합니다.

## 2. 환경 파일 및 프로젝트 이름

- `.env`: 애플리케이션/테스트 공용 설정(프로젝트 ID, 포트, Mongo/Redis/NATS/MinIO 접속 정보, 로그 설정 등). 기본값은 `host.docker.internal`을 바라보도록 되어 있으므로 다른 네트워크라면 호스트 IP를 맞춰 주세요.
- `.env.infra`: 로컬 인프라와 Jest Testcontainers에서 사용할 이미지 태그를 정의합니다.
    ```env
    MONGO_IMAGE=mongo:8.2.2
    REDIS_IMAGE=redis:8.0-alpine
    NATS_IMAGE=nats:2.11-alpine
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
    npm test                    # 전체
    TEST_ROOT=src/apps npm test  # 특정 경로만
    for i in {1..3}; do TEST_ROOT=src npm test; done  # 선택한 스위트를 n회 반복
    ```

    - Docker가 실행 중이어야 하며 `.env.infra`의 이미지 태그로 Testcontainers가 기동됩니다.

4. E2E 테스트 실행

    ```sh
    npm run test:e2e
    ```

    - 각 스위트마다 `npm run infra:reset`과 `npm run apps:reset`으로 인프라/애플리케이션을 초기화합니다.
    - 기본 호출 대상은 `http://host.docker.internal:${HTTP_PORT}`(기본 3000) 입니다.

5. 종료
    ```sh
    npm run apps:down
    npm run infra:down
    ```

## 4. 서비스 실행 및 디버깅

- Docker Compose로 전체 애플리케이션 빌드/실행: `npm run apps:up` 또는 `npm run apps:reset` (`compose.yml` 사용).
- 단일 서비스 디버깅(핫 리로드): `TARGET_APP=gateway npm run debug` (`TARGET_APP`은 `gateway`, `applications`, `cores`, `infrastructures` 중 선택).
- 빌드 후 실행: `TARGET_APP=gateway npm run build` → `TARGET_APP=gateway npm run start`.
- VS Code `Debug App` 구성에서 위 `TARGET_APP`을 선택해 바로 디버깅할 수 있습니다.

## 5. 개발 환경(Dev Container)

1. 호스트에서 [Git credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials)를 설정합니다.
2. VSCode에서 "Reopen in Container" 명령을 실행합니다.
3. Dev Container는 `.devcontainer/Dockerfile`(베이스 `node:24-bookworm`)을 사용하며, `postCreateCommand`/`postStartCommand`로 `npm ci` 및 `npm run infra:reset`을 자동 실행합니다.

## 6. 프로젝트 구조

```text
src
├── apps
│   ├── __tests__             # 통합 테스트
│   ├── applications
│   │   └── services
│   │       ├── booking              # 티켓 예매
│   │       ├── purchase             # 결제 처리
│   │       ├── recommendation       # 추천 서비스
│   │       └── showtime-creation    # 상영시간 생성
│   ├── cores
│   │   └── services
│   │       ├── customers            # 고객 인증/관리
│   │       ├── movies               # 영화 관리 (파일 업로드 포함)
│   │       ├── purchase-records     # 구매 기록 관리
│   │       ├── showtimes            # 상영 시간 관리
│   │       ├── theaters             # 극장 관리
│   │       ├── ticket-holding       # 티켓 선점 관리
│   │       ├── tickets              # 티켓 관리 (배열 유효성 검증 포함)
│   │       └── watch-records        # 관람 기록 관리
│   ├── gateway
│   │   └── controllers              # REST API 진입점
│   ├── infrastructures
│   │   └── services
│   │       ├── assets               # 파일 저장소 연동
│   │       └── payments             # 결제 시스템 연동
│   └── shared                       # 공통 코드
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
