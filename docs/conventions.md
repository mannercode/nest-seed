# 컨벤션

이 문서는 코드 스타일보다 **팀이 같은 방식으로 생각하고 읽기 위한 약속**을 정리합니다. 자동 포맷팅으로 해결되는 내용은 되도록 적지 않습니다.

---

## 1. 이름 짓기

### 1.1. 서비스 이름

서비스 이름은 맡고 있는 도메인 이름을 기준으로 짓습니다.

```ts
UsersService
MoviesService
ShowtimesService
```

여러 도메인을 묶는 서비스는 처리하는 유스케이스 이름을 사용합니다.

```ts
ShowtimeCreationService
PurchaseService
```

### 1.2. 메서드 이름

조회와 삭제처럼 ID만 받는 메서드는 처음부터 복수형으로 둡니다. 나중에 여러 ID를 한 번에 처리하더라도 API를 바꾸지 않기 위해서입니다.

```ts
getMany(ids: string[])
deleteMany(ids: string[])
```

생성이나 수정처럼 요청 본문이 필요한 메서드는 단수형을 사용합니다.

```ts
create(dto: CreateMovieDto)
update(dto: UpdateMovieDto)
```

### 1.3. DTO 이름

요청 DTO는 `동작 + 대상 + Dto` 형식으로 짓습니다.

```ts
CreateMovieDto
UpdateTheaterDto
SearchShowtimesDto
```

응답 타입은 꼭 필요할 때만 따로 만듭니다. 서비스 내부 모델을 그대로 반환해도 충분하다면 새 타입을 만들지 않습니다.

### 1.4. 경로 변수 접미사

파일 이름까지 포함하는 경로는 `Path`, 디렉터리만 가리키는 경로는 `Dir`로 끝냅니다. 변수 이름만 보고 호출 측에서 `path.join`을 더 붙여야 하는지 판단할 수 있어야 합니다.

```ts
workflowBundleDir = '_output/dist'                              // 디렉터리
workflowBundlePath = '_output/dist/showtime-creation.bundle.js' // 파일까지 포함
```

환경 변수와 설정 키에도 같은 규칙을 적용합니다 (`WORKFLOW_BUNDLE_DIR`, `LOG_DIR` 등).

---

## 2. 에러 규칙

도메인에서 예상할 수 있는 실패는 `errors.ts`에 모아 둡니다. 에러는 문자열을 바로 던지지 않고, 코드와 메시지를 가진 객체로 만듭니다.

```ts
export const UserErrors = {
    NotFound: () => ({ code: 'ERR_USER_NOT_FOUND', message: 'User does not exist.' }),
    EmailAlreadyExists: (email: string) => ({
        code: 'ERR_USER_EMAIL_ALREADY_EXISTS',
        message: 'Email is already registered.',
        email
    })
}
```

지켜야 할 약속은 다음과 같습니다.

- 에러 정의는 서비스 디렉터리 안의 `errors.ts` 파일로 분리합니다. 서비스 클래스 파일 안에 함께 적지 않습니다.
- 같은 디렉터리의 `index.ts`에서 `export * from './errors'`로 다시 내보냅니다.
- HTTP 4xx 응답에만 `code`를 함께 보냅니다. 5xx는 서버 장애이므로 클라이언트에게 자세한 원인을 노출하지 않습니다.
- `message`는 디버깅과 로그를 위한 참고 값입니다. 화면에 보여 줄 문구는 클라이언트가 `code`를 보고 정합니다.

---

## 3. 가져오기 규칙

각 폴더에는 `index.ts`를 둡니다. 폴더 밖에서 사용해도 되는 것만 `index.ts`에서 다시 내보냅니다. 이렇게 하면 공개 API를 한눈에 볼 수 있습니다.

가져오기 규칙은 두 가지입니다.

### 3.1. 상위 폴더는 상대 경로로 가져옵니다

자기보다 위에 있는 폴더를 가져올 때는 상대 경로를 사용합니다. 절대 경로 별칭으로 상위 폴더를 가져오면, 상위 폴더의 배럴 파일이 다시 하위 모듈을 가져오면서 순환 참조가 생기기 쉽습니다.

```ts
/* core/users/users.service.ts */
import { AuthService } from '../auth' // O
import { AuthService } from 'core' // X — core의 하위 모듈이 core 배럴을 다시 참조하므로 위험
```

### 3.2. 상위 경로에 속하지 않는 폴더는 절대 경로로 가져옵니다

상위 경로에 속하지 않는 폴더는 절대 경로 별칭을 사용합니다. 이런 경우 상대 경로를 쓰면 `../../../`가 길어져 읽기 어려워집니다.

```ts
/* gateway/users.http-controller.ts */
import { UsersService } from 'core' // O — gateway에서 core는 형제 묶음이므로 별칭 사용
```

모든 가져오기가 `index.ts`를 지나가면 의존 그래프가 단순해집니다. 순환 참조가 생겨도 빌드 오류로 빨리 드러납니다.

---

## 4. REST API 설계

### 4.1. URL은 리소스 중심으로 짓습니다

URL 경로는 *행위*가 아니라 *리소스*를 기준으로 짓습니다. 리소스 사이의 관계는 중첩 경로로 표현합니다.

```
GET    /movies                    목록
GET    /movies/:id                조회
POST   /movies                    생성
PATCH  /movies/:id                수정
DELETE /movies/:id                삭제
GET    /movies/:id/showtimes      하위 리소스
```

어떤 유스케이스는 여러 API 단계를 묶어서 진행해야 합니다. 그 단계가 해당 유스케이스 안에서만 의미 있다면 네임스페이스로 묶습니다. 단독으로도 의미가 있는 API와 구분하기 위해서입니다.

```
# 복합 유스케이스 — namespace로 묶음
GET  /booking/movies/:id/theaters
GET  /booking/showtimes/:id/tickets
POST /booking/showtimes/:id/tickets/hold

# 다른 맥락에서도 단독으로 의미가 있음 — namespace 없이 둠
GET  /showtimes/:id
```

### 4.2. ID만 받는 API는 처음부터 복수형으로 둡니다

ID만 받는 조회·삭제 API는 처음부터 복수형으로 설계합니다. 단수형으로 시작했다가 나중에 벌크 처리가 필요해지면 API를 깨야 하기 때문입니다. 생성·수정처럼 요청 본문을 받는 API는 단일 형태가 자연스럽습니다.

```ts
getMany(theaterIds: string[]) {}      // ID만 받는 API — 복수형
deleteMany(theaterIds: string[]) {}

create(dto: CreateTheaterDto) {}      // 요청 본문이 있는 API — 단일
update(dto: UpdateTheaterDto) {}
```

REST API에서 단일 항목을 다루는 엔드포인트가 필요하면, 컨트롤러가 ID 하나를 배열로 감싸 서비스의 복수형 메서드를 호출합니다.

```ts
@Get(':id')
async get(@Param('id') id: string) {
    return this.service.getMany([id])
}
```

### 4.3. 오래 걸리는 작업은 비동기로 처리합니다

처리에 시간이 걸리는 작업은 바로 결과를 반환하려 하지 않습니다. 먼저 `202 Accepted`와 sagaId를 응답하고, 진행 상황은 SSE로 보냅니다.

```
POST /some-resource         → 202 { sagaId }
GET  /some-resource/events  → SSE { status, sagaId }
```

### 4.4. 쿼리 파라미터가 길어질 수 있으면 POST를 사용합니다

GET의 쿼리 스트링에는 길이 제한이 있습니다. 일부 프록시에서 잘릴 수도 있습니다. 배열이나 긴 필터를 받는 검색 API는 처음부터 POST로 만드는 편이 안전합니다.

```
POST /showtimes/search
{ "theaterIds": [...] }
```

---

## 5. 데이터 비정규화

조회 성능을 높이고 계층 사이의 의존을 줄일 수 있다면 데이터를 어느 정도 중복 저장해도 됩니다. 예를 들어 `Ticket`에 `movieId`와 `theaterId`를 함께 저장해 두면 티켓을 조회할 때마다 `ShowtimesService`를 다시 부르지 않아도 됩니다.

대신 중복된 값은 항상 함께 갱신해야 합니다. 이 부담보다 조회 단순성이 더 중요하다면 중복 저장을 선택합니다.

---

## 6. Type vs Interface

기본은 `type`입니다. `interface`는 클래스가 `implements`해야 하거나, 선언 병합으로 외부에서 확장될 수 있는 자리에만 사용합니다.

---

## 7. 커밋 메시지

[`@commitlint/config-conventional`](https://github.com/conventional-changelog/commitlint) 규칙을 따릅니다. 규칙을 어기면 commit이 거절됩니다.

형식은 `type(scope): subject`입니다. 사용할 수 있는 type은 `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `style`입니다.

예: `feat: add user login`, `fix(api): handle null pointer in auth`
