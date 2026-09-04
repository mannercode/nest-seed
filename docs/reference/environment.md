# 환경 변수

이 문서는 env의 소유권과 주입 시점만 설명한다. 정확한 키와 개발 값은 각 env 파일, 필수 여부와 형식은 검증 스키마가 소유한다.

## 1. 값의 소유권

| 위치                                      | 소유하는 값                                     |
| ----------------------------------------- | ----------------------------------------------- |
| `.env.infra`                              | 개발 인프라와 고정 admin                        |
| `.env.api`                                | API 런타임, 인증, 로그                          |
| `apps/api/api-docs/.env`                  | 실행 가능한 API 문서의 대상 서버와 파일 fixture |
| `apps/console/.env`, `apps/user-app/.env` | 각 Next.js BFF의 API 대상과 신뢰 proxy opt-in   |

`NODE_ENV`처럼 entry point가 결정하는 값은 공용 env 파일에 두지 않는다.

## 2. 주입과 재생성

Dev Container는 생성할 때 `.env.api`와 `.env.infra`를 `process.env`로 주입한다. API는 env 파일을 직접 읽지 않고 주입된 환경을 부팅 시 검증한다. env를 바꾼 뒤의 재생성 절차는 [Dev Container 문서](../devcontainer.md#1-환경-변수는-재생성해야-반영된다)가 소유한다.

Dev Container가 사용하는 Docker `--env-file`은 shell script가 아니다. 따옴표를 붙이면 문자 그대로 값에 포함되고, 다른 변수를 `${...}`로 참조해도 보간되지 않는다.

```dotenv
API_HOST=api
API_URL=http://${API_HOST}:3000
PASSWORD="secret"
```

위 값에서 `API_URL`에는 `${API_HOST}`가 문자 그대로 남고, `PASSWORD`에는 따옴표까지 포함된다. 필요한 최종 값을 그대로 써야 한다.
