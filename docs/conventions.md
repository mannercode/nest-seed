# 컨벤션

이 문서는 코드 스타일보다 **팀이 같은 방식으로 생각하고 읽기 위한 약속**을 정리한다. 자동 포맷팅으로 해결되는 내용은 되도록 적지 않는다.

---

## 1. 이름 짓기

### 1.1. 서비스 이름

서비스 이름은 담당하는 도메인 이름을 기준으로 짓는다.

```ts
UsersService
MoviesService
ShowtimesService
```

여러 도메인을 묶는 서비스는 그 서비스가 처리하는 유스케이스 이름을 쓴다.

```ts
ShowtimeCreationService
PurchaseService
```

### 1.2. 메서드 이름

조회와 삭제처럼 ID만 받는 메서드는 처음부터 복수형으로 둔다. 나중에 여러 ID를 한 번에 처리해야 할 때 API를 바꾸지 않기 위해서다.

```ts
getMany(ids: string[])
deleteMany(ids: string[])
```

생성이나 수정처럼 본문 데이터가 필요한 메서드는 단수형을 쓴다.

```ts
create(dto: CreateMovieDto)
update(dto: UpdateMovieDto)
```

### 1.3. DTO 이름

요청 DTO는 `동작 + 대상 + Dto` 형식으로 짓는다.

```ts
CreateMovieDto
UpdateTheaterDto
SearchShowtimesDto
```

응답 타입은 꼭 필요할 때만 별도로 만든다. 서비스 내부 모델을 그대로 반환해도 충분하면 새 타입을 늘리지 않는다.

---

## 2. 에러 규칙

도메인에서 예상할 수 있는 실패는 `errors.ts`에 모아 둔다. 에러는 문자열을 바로 던지지 않고, 코드와 메시지를 가진 객체로 만든다.

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

지켜야 할 약속은 다음과 같다.

- 에러 정의는 서비스 디렉토리 안의 `errors.ts` 파일로 분리한다. 서비스 클래스 파일 안에 같이 적지 않는다.
- 같은 디렉토리의 `index.ts`에서 `export * from './errors'`로 다시 내보낸다.
- HTTP 4xx 응답에만 `code`를 함께 보낸다. 5xx는 서버 장애라서 클라이언트에게 자세한 원인을 보여 주지 않는다.
- `message`는 디버깅과 로그를 위한 참고 값이다. 화면에 보여 줄 문구는 클라이언트가 `code`를 보고 정한다.

---

## 3. Import 규칙

각 폴더에는 `index.ts`를 둔다. 그 폴더 밖에서 써도 되는 것만 `index.ts`에서 다시 내보낸다. 이렇게 하면 공개 API가 한눈에 보인다.

Import 규칙은 두 가지다.

### 3.1. 부모 폴더는 상대 경로로 가져온다

자기보다 위에 있는 폴더를 가져올 때는 상대 경로를 쓴다. 절대 경로 별칭으로 부모 폴더를 가져오면, 부모의 배럴 파일이 다시 자식을 가져오면서 순환 참조가 생기기 쉽다.

```ts
/* core/users/users.service.ts */
import { AuthService } from '../auth' // O
import { AuthService } from 'core' // X — core의 자식이 core 배럴을 다시 참조하므로 위험
```

### 3.2. 부모 줄기가 아닌 폴더는 절대 경로로 가져온다

부모 줄기에 있지 않은 폴더는 절대 경로 별칭을 쓴다. 이 경우 상대 경로를 쓰면 `../../../`가 길어져 읽기 어려워진다.

```ts
/* gateway/users.http-controller.ts */
import { UsersService } from 'core' // O — gateway에서 core는 형제 묶음이므로 별칭 사용
```

모든 import가 `index.ts`를 지나가면 의존 그래프가 단순해진다. 순환 참조가 생겼을 때도 빌드 오류로 빨리 드러난다.

---

## 4. REST API 설계

### 4.1. URL은 리소스 중심으로 짓는다

URL 경로는 _행위_가 아니라 _리소스_를 기준으로 짓는다. 리소스 사이의 관계는 중첩 경로로 표현한다.

```
GET    /movies                    목록
GET    /movies/:id                조회
POST   /movies                    생성
PATCH  /movies/:id                수정
DELETE /movies/:id                삭제
GET    /movies/:id/showtimes      하위 리소스
```

어떤 유스케이스는 여러 API 단계를 묶어서 진행해야 한다. 그 단계가 그 유스케이스 안에서만 의미가 있다면 namespace로 묶는다. 단독으로도 의미가 있는 API와 구분하기 위해서다.

```
# 복합 유스케이스 — namespace로 묶음
GET  /booking/movies/:id/theaters
GET  /booking/showtimes/:id/tickets
POST /booking/showtimes/:id/tickets/hold

# 다른 맥락에서도 단독으로 의미가 있음 — namespace 없이 둠
GET  /showtimes/:id
```

### 4.2. ID만 받는 API는 처음부터 복수형으로 둔다

ID만 받는 조회·삭제 API는 처음부터 복수형으로 설계한다. 단수로 시작했다가 나중에 벌크 처리가 필요해지면 API를 깨야 하기 때문이다. 생성·수정처럼 본문을 받는 API는 단일 형태가 자연스럽다.

```ts
getMany(theaterIds: string[]) {}      // ID만 받는 API — 복수형
deleteMany(theaterIds: string[]) {}

create(dto: CreateTheaterDto) {}      // 본문이 있는 API — 단일
update(dto: UpdateTheaterDto) {}
```

REST API에서 단일 항목을 다루는 엔드포인트가 필요하면, 컨트롤러가 ID 하나를 배열로 감싸서 서비스의 복수형 메서드를 호출한다.

```ts
@Get(':id')
async get(@Param('id') id: string) {
    return this.service.getMany([id])
}
```

### 4.3. 오래 걸리는 작업은 비동기로 처리한다

처리에 시간이 걸리는 작업은 바로 결과를 돌려주려 하지 않는다. 먼저 `202 Accepted`와 sagaId를 응답한다. 진행 상황은 SSE로 보낸다.

```
POST /some-resource         → 202 { sagaId }
GET  /some-resource/events  → SSE { status, sagaId }
```

### 4.4. 쿼리 파라미터가 길어질 수 있으면 POST를 쓴다

GET의 쿼리 스트링은 길이 제한이 있다. 일부 프록시에서 잘릴 수도 있다. 배열이나 긴 필터를 받는 검색 API는 처음부터 POST로 만드는 편이 안전하다.

```
POST /showtimes/search
{ "theaterIds": [...] }
```

---

## 5. 데이터 비정규화

조회 성능을 높이고 계층 사이 의존을 줄일 수 있다면, 데이터를 어느 정도 중복 저장해도 된다. 예를 들어 `Ticket`에 `movieId`와 `theaterId`를 함께 저장해 두면, 티켓을 조회할 때마다 `ShowtimesService`를 다시 부르지 않아도 된다.

대신 중복된 값은 항상 함께 갱신해야 한다. 그 부담보다 조회 단순성이 더 중요하다면 중복 저장이 더 나은 선택이다.

---

## 6. Type vs Interface

기본은 `type`이다. `interface`는 클래스가 `implements`해야 하거나, 선언 병합으로 외부에서 확장될 수 있는 자리에만 쓴다.

---

## 7. 커밋 메시지

[`@commitlint/config-conventional`](https://github.com/conventional-changelog/commitlint) 규칙을 따른다. 규칙을 어기면 commit이 거절된다.

형식은 `type(scope): subject`다. 사용할 수 있는 type은 `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `style`이다.

예: `feat: add user login`, `fix(api): handle null pointer in auth`
