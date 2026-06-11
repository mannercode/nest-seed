# 컨벤션

이 문서는 코드 스타일보다 **팀이 같은 방식으로 생각하고 읽기 위한 약속**을 정리한다. 자동 포맷팅으로 해결되는 내용은 되도록 적지 않는다.

---

## 1. 이름 짓기

### 1.1. 서비스 이름

서비스 이름은 맡고 있는 도메인 이름을 기준으로 짓는다.

```ts
UsersService
MoviesService
ShowtimesService
```

여러 도메인을 묶는 서비스는 처리하는 유스케이스 이름을 사용한다.

```ts
ShowtimeCreationService
PurchaseService
```

### 1.2. 메서드 이름

ID만 받는 조회·삭제 메서드는 처음부터 복수형(`getMany`, `deleteMany`)으로, 요청 본문을 받는 생성·수정 메서드는 단수형(`create`, `update`)으로 짓는다. 이유와 컨트롤러 패턴은 [§4.2](#42-id만-받는-api는-처음부터-복수형으로-둔다)에 있다.

### 1.3. DTO 이름

요청 DTO는 `동작 + 대상 + Dto` 형식으로 짓는다.

```ts
CreateTheaterDto
UpdateUserDto
SearchTheatersPageDto
```

응답 타입은 꼭 필요할 때만 따로 만든다. 서비스 내부 모델을 그대로 반환해도 충분하다면 새 타입을 만들지 않는다.

### 1.4. 경로 변수 접미사

파일 이름까지 포함하는 경로는 `Path`, 디렉터리만 가리키는 경로는 `Dir`로 끝낸다. 변수 이름만 보고 호출 측에서 `path.join`을 더 붙여야 하는지 판단할 수 있어야 한다.

```ts
workflowBundleDir = '_output/workflows/showtime-creation' // 디렉터리
workflowBundlePath = '_output/workflows/showtime-creation/workflow.js' // 파일까지 포함
```

환경 변수와 설정 키도 디렉터리를 가리키면 이름에 그대로 드러낸다 (`LOG_DIRECTORY` 등).

---

## 2. 에러 규칙

도메인에서 예상할 수 있는 실패는 `errors.ts`에 모아 둔다. 에러는 문자열을 바로 던지지 않고, 코드와 메시지를 가진 객체로 만든다.

```ts
export const MovieErrors = {
    NotFound: (notFoundMovieId: string) => ({
        code: 'ERR_MOVIE_NOT_FOUND',
        message: 'The movie does not exist.',
        notFoundMovieId
    }),
    InvalidForPublish: (missingFields: string[]) => ({
        code: 'ERR_MOVIE_INVALID_FOR_PUBLISH',
        message: 'The movie is not ready to be published.',
        missingFields
    })
}
```

지켜야 할 약속은 다음과 같다.

- 에러 정의는 서비스 디렉터리 안의 `errors.ts` 파일로 분리한다. 서비스 클래스 파일 안에 함께 적지 않는다.
- 같은 디렉터리의 `index.ts`에서 `export * from './errors'`로 다시 내보낸다.
- 단순 파싱/검증처럼 한 파일 안에서만 쓰는 gateway 계층([아키텍처](architecture.md) 참고)의 에러는 예외적으로 가까운 곳에 둘 수 있다. 예: `RequestValidationPipeErrors`, URL 날짜 파싱 에러. 여러 핸들러나 서비스에서 재사용되면 `errors.ts`로 옮긴다.
- 클라이언트가 분기해야 하는 HTTP 4xx 응답에 `code`를 함께 보낸다. 5xx는 서버 장애이므로 클라이언트에게 자세한 원인을 노출하지 않는다.
- `message`는 디버깅과 로그를 위한 참고 값이다. 화면에 보여 줄 문구는 클라이언트가 `code`를 보고 정한다.

---

## 3. 가져오기 규칙

각 폴더에는 `index.ts`를 둔다. 폴더 밖에서 사용해도 되는 것만 `index.ts`에서 다시 내보낸다. 이렇게 하면 공개 API를 한눈에 볼 수 있다.

가져오기 규칙은 두 가지이다.

### 3.1. 상위 폴더는 상대 경로로 가져온다

자기보다 위에 있는 폴더를 가져올 때는 상대 경로를 사용한다. 절대 경로 별칭으로 상위 폴더를 가져오면 순환 참조가 생기기 쉽다. 상위 폴더의 `index.ts`(폴더의 공개 내보내기를 모은 파일, 보통 배럴이라고 부른다)가 다시 하위 모듈을 가져오기 때문이다.

```ts
/* core/users/internal/user-authentication.service.ts */
import { UsersRepository } from '../users.repository' // O
import { UsersRepository } from 'core' // X — core의 index.ts가 users를 재참조해 순환이 생긴다
```

### 3.2. 상위 경로에 속하지 않는 폴더는 절대 경로로 가져온다

상위 경로에 속하지 않는 폴더는 절대 경로 별칭을 사용한다. 이런 경우 상대 경로를 쓰면 `../../../`가 길어져 읽기 어려워진다.

```ts
/* gateway/users.http-controller.ts */
import { UsersService } from 'core' // O — gateway에서 core는 형제 묶음이므로 별칭 사용
```

모든 가져오기가 `index.ts`를 지나가면 의존 그래프가 단순해진다. 순환 참조가 생겨도 빌드 오류로 빨리 드러난다.

---

## 4. REST API 설계

### 4.1. URL은 리소스 중심으로 짓는다

URL 경로는 *행위*가 아니라 *리소스*를 기준으로 짓는다. 리소스 사이의 관계는 중첩 경로로 표현한다.

```
GET    /movies                       목록
GET    /movies/:movieId              조회
POST   /movies                       생성
PATCH  /movies/:movieId              수정
DELETE /movies/:movieId              삭제
POST   /movies/:movieId/assets       하위 리소스
```

어떤 유스케이스는 여러 API 단계를 묶어서 진행해야 한다. 그 단계가 해당 유스케이스 안에서만 의미 있다면 네임스페이스로 묶는다. 단독으로도 의미가 있는 API와 구분하기 위해서다.

```
# 복합 유스케이스 — namespace로 묶음
GET  /booking/movies/:id/theaters
GET  /booking/showtimes/:id/tickets
POST /booking/showtimes/:id/tickets/hold

# 다른 맥락에서도 단독으로 의미가 있음 — namespace 없이 둠
GET  /movies/:movieId
```

### 4.2. ID만 받는 API는 처음부터 복수형으로 둔다

ID만 받는 조회·삭제 API는 처음부터 복수형으로 설계한다. 단수형으로 시작했다가 나중에 벌크 처리가 필요해지면 API를 깨야 하기 때문이다. 생성·수정처럼 요청 본문을 받는 API는 단일 형태가 자연스럽다.

```ts
getMany(theaterIds: string[]) {}      // ID만 받는 API — 복수형
deleteMany(theaterIds: string[]) {}

create(dto: CreateTheaterDto) {}                        // 요청 본문이 있는 API — 단일
update(theaterId: string, dto: UpdateTheaterDto) {}
```

REST API에서 단일 항목을 다루는 엔드포인트가 필요하면, 컨트롤러가 ID 하나를 배열로 감싸 서비스의 복수형 메서드를 호출한다.

```ts
@Get(':id')
async get(@Param('id') id: string) {
    return this.service.getMany([id])
}
```

### 4.3. 오래 걸리는 작업은 비동기로 처리한다

처리에 시간이 걸리는 작업은 바로 결과를 반환하려 하지 않는다. 먼저 `202 Accepted`와 작업 추적용 식별자(sagaId)를 응답하고, 진행 상황은 SSE(Server-Sent Events)로 보낸다.

```
POST /some-resource         → 202 { sagaId }
GET  /some-resource/events  → SSE { status, sagaId }
```

### 4.4. 쿼리 파라미터가 길어질 수 있으면 POST를 사용한다

GET의 쿼리 스트링에는 길이 제한이 있다. 일부 프록시에서 잘릴 수도 있다. 배열이나 긴 필터를 받는 검색 API는 처음부터 POST로 만드는 편이 안전하다.

```
POST /showtime-creation/showtimes/search
{ "theaterIds": [...] }
```

### 4.5. 권한 경계: 본인 자원은 `/me`, 임의 ID는 admin

본인 자원은 경로에 식별자가 없는 **`/me` 계열**로 다룬다. 식별자를 인증 토큰의 주체(`req.user.sub`)로 못박으므로, 로그인 사용자가 임의 ID를 넣어 남의 자원에 접근하는 경로(IDOR) 자체가 생기지 않는다. 임의 ID를 다루는 작업은 모두 admin이다 — `/me`(본인)와 `/:id`(운영자)로 권한 경계가 갈린다. 결제도 같은 원칙이라 `POST /purchases`는 본문이 아니라 토큰 주체로 결제자를 정한다.

가드는 한 컨트롤러에 서로 다른 역할의 핸들러가 섞이면 핸들러마다 붙이고, 모든 핸들러가 같은 역할이면 클래스에 붙인다. 이렇게 나누는 이유는 NestJS에서 클래스 가드와 메서드 가드가 합쳐져 둘 다 통과해야 하기 때문이다. 상세는 [users.http-controller.ts](../apps/api/src/services/gateway/users.http-controller.ts) 머리 주석에 있다.

---

## 5. 데이터 비정규화

조회 성능을 높이고 계층 사이의 의존을 줄일 수 있다면 데이터를 어느 정도 중복 저장해도 된다. 예를 들어 `Ticket`에 `movieId`와 `theaterId`를 함께 저장해 두면 티켓을 조회할 때마다 `ShowtimesService`를 다시 부르지 않아도 된다.

대신 중복된 값은 항상 함께 갱신해야 한다. 이 부담보다 조회 단순성이 더 중요하다면 중복 저장을 선택한다.

---

## 6. Type vs Interface

기본은 `type`이다. `interface`는 클래스가 `implements`해야 하거나, 같은 이름으로 다시 선언해 필드를 더할 수 있어야 하는(선언 병합) 자리에만 사용한다.

---

## 7. 커밋 메시지

[`@commitlint/config-conventional`](https://github.com/conventional-changelog/commitlint) 규칙을 따른다. `commit-msg` 훅이 강제하므로 규칙을 어기면 commit이 거절된다. `pre-commit` 훅은 staged 파일에 ESLint `--fix`와 Prettier를 자동 적용한다(lint-staged).

형식은 `type(scope): subject`이다. 사용할 수 있는 type은 `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `style`이다.

예: `feat: add user login`, `fix(api): handle null pointer in auth`

---

## 8. 실패는 빨리 드러낸다

문제를 덮는 폴백 대신, 잘못된 상태를 그 자리에서 명시적으로 실패시킨다. 폴백은 오류를 뒤로 미루고, 미뤄진 오류는 원인에서 먼 곳에서 엉뚱한 모습으로 나타난다.

- 셸 스크립트의 필수 변수는 `${VAR:?}`로 선언한다. 비어 있으면 그 줄에서 죽는다.
- 앱은 부팅할 때 Joi 스키마로 `process.env`를 검증한다. 값이 빠지면 서버가 뜨지 않는다.
- 코드에서 "반드시 있어야 하는" 값은 `Require.defined`·`ensure`로 단언한다. 임의의 기본값을 만들어 계속 진행하지 않는다.
- 정리 작업이 대상을 못 찾으면 조용히 넘어가지 않고 예외를 던진다. 무음 no-op은 성공처럼 보이는 실패다.

---

## 9. 값은 어디에 두나

환경마다 달라지는 값만 환경 변수로 받는다. 접속 정보, 포트, 시크릿이 여기에 속하고, 부팅할 때 검증한다. 흐름은 [환경 변수](environment.md)에 있다.

도메인 정책 값은 코드에 둔다. 홈 화면의 영화 수, 정리 cron 주기, 티켓 가격 기본값처럼 환경별로 바꿀 일이 없는 값은 사용하는 코드 옆의 상수나 설정 스키마의 기본값으로 적는다. 모든 값을 env로 빼면 설정 파일이 두 번째 코드베이스가 된다.

---

## 10. npm 스크립트 계약

루트 package.json이 진입점이다. 루트는 동사를 워크스페이스로 팬아웃하고(`npm run <동사> --workspaces --if-present`), 각 워크스페이스는 자기가 지원하는 동사만 같은 이름으로 구현한다. 보조 단계는 npm의 pre/post 훅(`prelint`, `postformat`, `preatoz`)으로 잇는다.

| 동사     | 의미                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------- |
| `dev`    | watch 모드 실행                                                                                       |
| `build`  | 빌드 산출물 생성                                                                                      |
| `test`   | 개발 루프용 빠른 회귀. devcontainer 인프라를 재사용하는 Jest                                          |
| `lint`   | 타입 체크 + ESLint + Prettier 검사                                                                    |
| `format` | ESLint `--fix` + Prettier 쓰기                                                                        |
| `e2e`    | 콘솔 브라우저 시나리오 (tests/console-e2e)                                                            |
| `atoz`   | 클린룸 전체 회귀 — clean·인프라 리셋·`npm ci` 후 lint·build·test·e2e·배포 검증까지. `test`를 포함한다 |
| `clean`  | (루트 전용) `git clean -fdX`로 추적되지 않는 파일 정리                                                |

`atoz`의 워크스페이스 구현은 "그 워크스페이스를 전부 검증한다"는 의미만 같고 단계는 각자 다르다. libs는 build→lint→test, Next 앱은 테스트가 없어 lint→build, api는 배포 검증에서 Docker가 빌드를 맡으므로 lint→test다.
