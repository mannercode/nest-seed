# 환경 변수

이 문서는 값의 목록이 아니라 **누가 값을 소유하고, 언제 반영되는지**를 설명한다. 정확한 키와 기본값은 각 env 파일과 검증 스키마가 소유한다.

## 1. 값의 소유권

| 위치                                      | 소유하는 값                                     |
| ----------------------------------------- | ----------------------------------------------- |
| `.env.infra`                              | 개발 인프라와 고정 admin                        |
| `.env.api`                                | API 런타임, 인증, 로그                          |
| `apps/api/api-docs/.env`                  | 실행 가능한 API 문서의 대상 서버와 파일 fixture |
| `apps/console/.env`, `apps/user-app/.env` | 각 Next.js BFF의 API 대상과 신뢰 proxy opt-in   |

인프라와 고정 개발 admin은 `.env.infra`, API 런타임 값은 `.env.api`가 소유한다. `NODE_ENV`처럼 실행 방식이 결정해야 하는 값은 공용 env에 두지 않고 해당 entry point가 정한다.

인프라 이미지는 버전을 읽을 수 있는 tag와 실제 바이트를 고정하는 digest를 함께 사용한다. 이미지를 올릴 때는 두 값이 같은 release를 가리키는지 확인한다. 어떤 파일이 해당 이미지를 쓰는지는 Dependabot 설정과 저장소 검색이 소유한다.

## 2. 주입과 재생성

Dev Container가 생성될 때 API와 인프라 env가 컨테이너의 `process.env`로 주입된다. API는 `.env` 파일을 직접 읽지 않고 이 환경을 부팅 시 검증한다. 따라서 `.env.api`나 `.env.infra`를 바꾼 뒤에는 Dev Container를 재시작하는 것이 아니라 **재생성**해야 한다. reset과 외부 테스트 스크립트는 독립 실행을 위해 `.env.infra`를 직접 읽는다. 실행 가능한 API 문서는 상위 디렉터리의 env 파일을 읽지 않으며, 저장소 통합 실행기인 `tests/api/runner.sh`가 개발용 admin 값을 주입한다.

`infra/reset.sh`는 `.env.infra`의 admin 값을 `pnpm run admin:create`의 표준입력으로 넘긴다. 이 명령은 MongoDB 접속 정보만 환경에서 읽고, admin의 email, name, password는 프롬프트로 입력받아 애플리케이션을 빌드하거나 부팅하지 않고 MongoDB에 직접 생성한다. 실제 배포에서 최초 admin이 필요하면 MongoDB 접속 정보를 주입한 API 이미지를 대화형으로 실행해 각 값을 직접 입력한다.

Dev Container가 사용하는 Docker `--env-file`은 shell script가 아니다. 따옴표를 붙이면 문자 그대로 값에 포함되고, 다른 변수를 `${...}`로 참조해도 보간되지 않는다.

```dotenv
API_HOST=api
API_URL=http://${API_HOST}:3000
PASSWORD="secret"
```

위 값에서 `API_URL`에는 `${API_HOST}`가 문자 그대로 남고, `PASSWORD`에는 따옴표까지 포함된다. 필요한 최종 값을 그대로 써야 한다.

서비스 DNS·포트는 env, Compose, NGINX 경계에 리터럴로 남을 수 있다. 이 값을 바꿀 때는 문서의 수동 표를 믿지 말고 저장소 전체에서 기존 값과 변수명을 검색한 뒤 `atoz`로 경계를 검증한다.

## 3. 포크할 때 확인할 것

`nest-seed`나 `mannercode`를 저장소 전체에서 일괄 치환하지 않는다. 같은 문자열이라도 내부 식별자, 저작자 소유 URL, 인증 issuer, 테스트 격리 이름처럼 의미가 다르다.

다음 범주를 새 프로젝트 정책에 맞게 각각 검토한다.

- 패키지 이름과 내부 scope
- Compose project·network·배포 이미지 식별자
- API project ID, 인증 issuer/audience와 서명 secret
- DB·bucket·cookie·test fixture의 충돌 방지 이름
- README badge, 링크, 연락처의 소유권

개발용 secret은 시드 실행을 위한 기본값일 뿐이다. 운영 secret은 저장소에 커밋하지 않고 배포 환경의 secret 관리 경로에서 주입한다.

## 4. Quick Tunnel

`pnpm exec tunnel`은 console과 user-app의 Cloudflare Quick Tunnel을 함께 실행한다.
