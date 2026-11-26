# 저장소 작업 지침

## 작업 범위와 사용자 확인

먼저 루트 README와 변경할 영역의 문서·설정을 읽는다. 웹이 받는 API 응답을 바꾸면 양쪽 README를, 개발 인프라를 바꾸면 환경 변수 주입 방식도 확인한다. [프로젝트 구조](README.md#프로젝트-구조) · [환경 설정](README.md#환경-설정)

- 요청에 필요한 코드·테스트·타입·문서만 고친다. 사용자의 변경은 보존하고 별개 문제는 따로 알린다.
- 범위나 설계를 바꾸거나 요청 밖의 보안 조치를 하려면 먼저 묻는다. 문서와 코드 중 어느 쪽이 맞는지, API·데이터 모델·보안 경계·정합성·새 의존성을 어떻게 정할지 불분명할 때도 같다. 확인한 사실과 선택지별 영향, 추천안을 제시한다.
- 새 테스트 파일은 작성 전 동의를 받는다. 필요한 비밀 키·권한·서비스·원본 데이터·도구가 없으면 용도를 설명하고 요청한다. 임의로 대체하지 않는다.

## 실패 처리

- 필수 설정이 빠지면 오류를 알린다. 요청에 없는 기본값이나 대체 경로는 이유와 영향을 설명하고 동의를 받은 뒤 추가한다.
- 초기화 도중 실패해도 이미 연 연결을 닫는다. 실패·종료 때는 자원과 진행 중인 작업을 정리한다. 실행·정리 오류는 호출자에게 전달하고 스크립트도 실패 코드로 끝낸다.
- 테스트·타입 검사·lint·커버리지 기준을 낮추거나 검사를 생략하지 않는다. 통과시키려고 단언을 약하게 하거나 계약을 바꾸거나 결과를 하드코딩하지 않는다. 운영 코드에 테스트 전용 분기를 넣지 않는다.
- 경합이나 시작·종료 오류를 임의의 sleep·재시도·timeout 연장으로 숨기지 않는다.

    > ```ts
    > await Promise.all([mine.ready, other.ready])
    > const { body } = await fix.httpClient
    >     .post('/event-demo/messages')
    >     .headers({ Authorization: 'Bearer ' + otherSession.accessToken })
    >     .body({ message: 'other event' })
    >     .accepted()
    > expect(JSON.parse(await other.firstMessage())).toEqual({
    >     id: body.id,
    >     message: 'other event'
    > })
    > ```
    >
    > [SSE 구독과 메시지 발행 테스트](apps/api/src/__tests__/infrastructure/event-demo.spec.ts)

## 설계와 구현

- 문제가 생기는 조건과 영향을 확인하고 기존 기능이나 작은 수정으로 원인을 고칠 수 있는지 본다. 구조 변경으로 막을 오류와 늘어나는 의존성·실행 단계·호환성 유지 비용을 비교한다. 지금 구조로 충분하고 비용이 더 크면 유지하는 이유를 설명한다.
- 주소·경로·ID는 정한 쪽에서 받아 쓴다. 여러 곳에서 같은 값을 계산해야 하면 생성 함수를 공유한다.

    > ```ts
    > // EventDemoService 생성자
    > const { streamName, consumerName, subjects } = eventDemoResources(config.projectId)
    >
    > // 테스트의 ownsEventStream
    > const event = eventDemoResources(project)
    > return name === event.streamName && subject === event.subjects.queued
    > ```
    >
    > [스트림 설정](apps/api/src/services/infrastructure/event-demo/event-demo.service.ts) · [정리 대상 판별](apps/api/src/__tests__/helpers/resources.ts) · [공유하는 생성 함수](apps/api/src/services/infrastructure/event-demo/event-demo.resources.ts)

- 환경마다 따로 정하는 값은 해당 환경에서 얻는다.

    > ```js
    > // createEndpoint
    > server.listen(0, '0.0.0.0')
    > await once(server, 'listening')
    >
    > // endpoint.uri의 getter
    > const address = server.address()
    > if (!address || typeof address === 'string') {
    >     throw new Error('Restate recovery endpoint is not listening.')
    > }
    > return `http://${hostname()}:${address.port}`
    > ```
    >
    > ```js
    > endpoint = await createEndpoint(definition)
    > deploymentUrl = await registerEndpoint(definition.name, endpoint.uri)
    > ```
    >
    > [임시 서버 주소와 Restate 등록](infra/tests/restate-journal-recovery.test.js)

- 설정은 실행 코드에 연결하고 기본값·환경 변수·버전은 중복 선언하지 않는다. 의존성은 쓰는 패키지에 선언한다. 모듈은 필요한 기능만 공개하고 반환값은 타입·스키마와 맞춘다.
- `libs/`는 앱이 쓰지 않는 기능도 결함을 고치고 지원하던 입력과 동작을 보존한다. `apps/`·데모·개발 환경은 예제 동작과 테스트 신뢰성을 지키면서 다른 프로젝트가 가져다 고치기 쉽게 만든다.
- 라이브러리에서는 객체·유니온에 `type`, 클래스가 구현할 계약과 선언 병합에는 `interface`를 쓴다. 파일 경로 변수는 `Path`, 디렉터리 경로 변수는 `Dir`로 끝낸다.

| 필요한 파일이나 기능                                            | 경로 선택 기준                                   | 코드 예제                                                   |
| --------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| 하위 스크립트·테스트 설정에서 찾는 루트나 다른 workspace의 파일 | Dev Container의 `${WORKSPACE_ROOT}`를 우선 쓴다. | `base_compose_file="${WORKSPACE_ROOT:?}/infra/compose.yml"` |
| 다른 패키지                                                     | 패키지 이름                                      | `import { ensure } from '@mannercode/common'`               |
| 같은 앱·라이브러리의 다른 모듈                                  | 공개 진입점을 가리키는 별칭                      | `import { AssetsService } from '#infrastructure'`           |
| 같은 모듈의 이웃 파일                                           | 상대 경로 사용 가능                              | `import { RegistrationErrors } from './errors.js'`          |

[Compose 파일 경로](infra/stack.sh) · [가입 서비스의 import](apps/api/src/services/application/user-registration/user-registration.service.ts)

## 테스트는 한 행동의 결과를 검증한다

통합 테스트는 실제 호출자가 쓰는 가장 바깥의 공개 인터페이스에서 검증한다. HTTP 기능은 요청·응답과 후속 조회로, 라이브러리는 공개 함수나 메서드로 확인한다.

> ```ts
> await fix.httpClient.delete('/users/me').headers(headers).noContent()
> await fix.httpClient
>     .post('/users/login')
>     .body({ email: applicant.email, password: applicant.password })
>     .unauthorized()
> const { body: other } = await fix.httpClient
>     .get('/users/me')
>     .headers(otherHeaders)
>     .ok({ schema: UserSchema })
> expect(other.email).toBe('other@mail.com')
> ```
>
> [한 회원이 탈퇴한 뒤 두 회원의 접근을 확인하는 테스트](apps/api/src/__tests__/application/user-registration.spec.ts)

- **조회가 없으면** 그 값이 필요한 호출자를 찾는다. 다른 모듈이면 공개 서비스 메서드를, HTTP 클라이언트면 HTTP API를 추가해 검증한다. 테스트와 준비 도우미를 위해 비공개 Repository를 export하거나 깊은 import·별칭·타입 단언으로 접근하지 않는다.
- 롤백 테스트에서는 실제로 값을 저장한 뒤 장애를 일으키고, 실패 후 남은 상태를 확인한다.

    > ```ts
    > // beforeEach
    > vi.spyOn(
    >     fix.module.get<S3ObjectService>(S3ObjectService.getName()),
    >     'presignDownload'
    > ).mockRejectedValueOnce(new Error('signing failed'))
    >
    > // it
    > await fix.httpClient
    >     .post('/users')
    >     .body({ ...applicant, photoAssetId: assetId })
    >     .internalServerError()
    > expect(await fix.module.get(AssetsService).findOwner(assetId)).toBeNull()
    > await fix.httpClient
    >     .post('/users')
    >     .body({ ...applicant, photoAssetId: assetId })
    >     .created({ schema: UserSchema })
    > ```
    >
    > [사진 소유권을 쓴 뒤 URL 발급이 실패하는 테스트](apps/api/src/__tests__/application/user-registration.spec.ts)

- spy는 공개 서비스나 외부 연동 지점에서 장애·경합을 재현할 때만 쓴다. 내부 메서드의 호출 여부·횟수·인자를 결과로 단언하지 않는다.
- **외부 연동**은 상대 라이브러리나 서비스의 공개 API로 확인한다. DB·스토리지를 직접 읽는 검증은 저장 형식이나 원자적 갱신을 맡은 모듈에 둔다.

    > ```ts
    > const { refreshToken } = await fix.jwtService.generateAuthTokens({ sub: 'u1' })
    > const key = sessionKey(fix, refreshToken)
    > expect(await fix.redis.get(key)).toBe(createHash('sha256').update(refreshToken).digest('hex'))
    > for (const name of [key, userSessionIndex]) {
    >     expect(await fix.redis.pttl(name)).toBeGreaterThan(0)
    >     expect(await fix.redis.pttl(name)).toBeLessThanOrEqual(3000)
    > }
    > ```
    >
    > [Redis 세션 저장 테스트](libs/common/src/auth/__tests__/jwt-auth.service.spec.ts)

- `sendRaw()`를 쓰면 각 응답의 HTTP 상태 코드를 직접 검사한다.

    > ```ts
    > const count = emails.length
    > const serverUrl = fix.httpClient.serverUrl
    > const statuses = await Promise.all(
    >     emails.map(async (email) => {
    >         const client = new HttpTestClient(serverUrl)
    >         const response = await client
    >             .post('/users')
    >             .body(buildCreateUserDto({ email }))
    >             .sendRaw()
    >         return response.status
    >     })
    > )
    > const createdCount = statuses.filter((s) => s === 201).length
    > const conflictCount = statuses.filter((s) => s === 409).length
    > const otherStatuses = statuses.filter((s) => s !== 201 && s !== 409)
    > expect(createdCount).toBe(1)
    > expect(conflictCount).toBe(count - 1)
    > expect(otherStatuses).toEqual([])
    > ```
    >
    > [같은 이메일로 동시에 가입하는 테스트](apps/api/src/__tests__/core/users.spec.ts)

### 테스트 이름과 준비

- 각 러너의 문법에 맞춰 식별자는 영어로, 조건과 결과는 한국어로 쓴다. HTTP 응답은 “반환한다”, 서비스 예외는 “던진다”로 쓴다.
- 테스트가 하나여도 그룹 이름에 조건을 쓴다. 상위 그룹에서 행동이 드러나면 테스트 이름에는 결과만 쓴다. 재시도나 동시 요청처럼 구분할 행동이 있으면 이름에 포함한다.
- 조건을 나타내는 고정 입력은 그룹 안에 `const`로 둘 수 있다. 요청과 검증은 테스트 본문에 둔다.

    > ```ts
    > describe('POST /users', () => {
    >     describe('요청 본문이 빈 객체이면', () => {
    >         const emptyBody = {}
    >
    >         it('400을 반환한다', async () => {
    >             await fix.httpClient
    >                 .post('/users')
    >                 .body(emptyBody)
    >                 .badRequest({ expected: expectedErrors.validationFailed(expect.any(Array)) })
    >         })
    >     })
    > })
    > ```
    >
    > [빈 객체로 가입하는 테스트](apps/api/src/__tests__/core/users.spec.ts)

- 기존 사용자처럼 미리 필요한 상태는 준비 훅에서 테스트마다 새로 만든다. 같은 조건의 테스트는 훅을 공유한다. [기존 사용자의 이메일로 가입하는 테스트](apps/api/src/__tests__/core/users.spec.ts)
- Vitest에서 준비가 다르면 `describe.each`, 호출 인자만 다르면 `it.each`로 묶을 수 있다. 실행 순서나 검증 방법이 다르면 나눈다. [비밀번호별 가입 준비](apps/api/src/__tests__/core/users.spec.ts) · [단위 변환의 입력과 결과](libs/common/src/utils/__tests__/byte.spec.ts)
- 순서가 필요한 시나리오만 순서를 명시해 상태를 공유한다. Promise나 실제 상태로 완료를 확인하고 앱과 연결을 닫는다. TTL 만료 테스트에서는 만료 시각까지 기다릴 수 있다.

## 문서 작성과 배치

- 소개·시작 방법·폴더·개발 환경은 루트 README에, 영역별 설계와 계약은 해당 README에, 저장소 작업 규칙은 AGENTS.md에 둔다. 같은 설명은 한 곳에 쓰고 링크한다.
- 규칙은 짧게 쓴다. 이 문서의 예제는 규칙을 적용한 저장소 코드·명령·설정에서 필요한 줄만 발췌해 원본을 링크한다. 규칙 아래 인용 블록(`>`)이나 표의 예제 열에 둔다.
- 설계를 설명할 때는 기능을 둔 위치와 이유를 함께 쓴다.

    > Application의 가입 서비스는 가입 실패 때 계정만 남는 일을 막기 위해 계정 생성과 사진 소유권 등록에 같은 트랜잭션을 전달한다.
    >
    > ```ts
    > return this.transaction.withTransaction(async (transaction) => {
    >     const created = await this.users.create(user, photoAssetId, transaction)
    >     await this.assets.finalizeUpload(
    >         photoAssetId,
    >         { owner: { service: 'users', entityId: created.id } },
    >         transaction
    >     )
    >     return created
    > })
    > ```
    >
    > [사진 첨부 가입 설계](apps/api/README.md#어디에-책임을-둘까) · [가입 서비스](apps/api/src/services/application/user-registration/user-registration.service.ts)

- 사용 순서와 성공·실패는 실행 예제로 보여 준다. API 예제 테스트는 독자에게 준 예제로 요청 순서와 HTTP 상태를 확인한다. 응답 본문·상태 변경·실패 처리는 실제 모듈과 인프라를 연결한 통합 테스트에서 검증한다. README에는 명령과 기대 결과를 쓴다. [가입 예제](apps/api/api-docs/users.spec) · [API 테스트 안내](apps/api/README.md#테스트)
- 반복하는 빌드·준비·정리는 명령에, 자동 검사할 규칙은 테스트나 설정에 둔다. 기본값·옵션·내부 호출 순서는 원본으로 연결한다. 데이터 삭제처럼 실행 전 알아야 할 영향, 호환성 제약, 호출자에게 보장하는 동작은 명시한다.
- 문서·주석·테스트 이름에는 누가 어떤 조건에서 무엇을 하면 어떻게 되는지 쓴다. 문장을 다듬어도 조건·보장·예외는 보존한다. 사용법·계약·제약·선택 이유가 바뀌면 설명·명령·링크도 고친다.

## 변경 검증과 커밋

- 동작이나 보장이 바뀌면 해당 테스트를 고친다. 경로·의존성 변경은 기존 호출자의 디렉터리·옵션·입력으로 검증한다. import 별칭은 타입 검사·테스트·빌드한 배포본에서 모두 확인한다.
- 개발자와 CI의 전체 검사는 루트 package script에, 앱 컨테이너 관리·인프라 초기화·복제본 검증은 `infra`에 둔다. 각 workspace의 `dev`, `build`, `test`, `lint`는 같은 뜻으로 쓴다.
- API와 common의 전체 테스트는 커버리지 100%를 유지한다. 컨테이너 검사는 환경 전환 명령으로 한 번에 하나씩 실행한다. [검사 명령](README.md#실행과-검증)
- 변경에 맞는 검사 결과와 실행하지 못한 검사의 이유를 알린다. 검증 후 이번 변경만 로컬에 커밋하고, 원격 푸시는 요청받았을 때 한다.
