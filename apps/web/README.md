# 웹 앱

사진을 첨부해 가입하고 로그인한 사용자가 본인 정보를 조회하는 예제다. 브라우저는 같은 출처의 웹 서버에 요청하고, 웹 서버가 API 인증과 사진 전송을 맡는다. [사진 첨부 가입 E2E](tests/e2e/user-auth-flow.spec.ts)

## 인증 쿠키와 토큰 갱신

로그인하면 웹 서버가 API에서 받은 토큰을 HttpOnly 쿠키로 설정한다. 화면은 토큰을 읽거나 저장할 필요 없이 웹 클라이언트를 쓴다. 클라이언트가 경로 앞에 `/api`를 붙여 같은 출처의 웹 서버로 요청을 보낸다. [로그인 화면](src/app/login/page.tsx) · [홈 화면](src/app/page.tsx) · [웹 클라이언트](src/lib/api-client.ts)

| 화면에서 하는 호출                                         | 브라우저 요청             | 성공 응답                 |
| ---------------------------------------------------------- | ------------------------- | ------------------------- |
| `await postNoContent('/users/login', { email, password })` | `POST /api/users/login`   | 204, 본문 없음            |
| `await getJson<HomeView>('/views/web/home')`               | `GET /api/views/web/home` | 200, `{ user, photoUrl }` |

보호 요청이 401을 받고 갱신 쿠키가 있으면 웹 서버가 토큰을 갱신해 원래 요청을 다시 보낸다. 같은 웹 서버 프로세스는 같은 갱신 쿠키로 들어온 동시 요청에 한 번의 갱신 결과를 공유하고, 갱신 직후 도착한 요청에도 잠시 그 결과를 재사용한다.

다른 인스턴스가 토큰을 먼저 교체해 API가 409를 반환하면 웹 서버는 충돌을 전달하고 쿠키를 보존한다. 늦게 도착한 응답이 새 세션 쿠키를 지우는 일을 막기 위해서다. 갱신 토큰 자체가 무효여서 API가 401을 반환하면 두 인증 쿠키를 지운다. 갱신 서비스에 연결할 수 없으면 쿠키를 보존하고 502를 반환하므로 서비스가 복구된 뒤 다시 요청할 수 있다. [인증 프록시](src/app/api/%5B...path%5D/route.ts) · [쿠키 갱신·충돌 테스트](tests/e2e/user-auth-flow.spec.ts)

## 사진 프록시

브라우저는 웹 앱에 사진을 보내고 웹 서버가 S3 주소에 접속한다. 이 경로를 사용하면 개발용 저장소를 Docker 네트워크 안에 둘 수 있다. 웹 서버에는 API와 같은 `S3_ENDPOINT`와 `S3_BUCKET`을 지정한다. S3 서명에는 호스트·경로·쿼리가 포함되므로 웹 서버는 대상 버킷을 확인한 뒤 발급된 URL 그대로 업로드와 다운로드를 전달한다. 버킷이 호스트명에 들어가는 주소를 쓸 때는 웹 서버에서 그 호스트도 해석할 수 있어야 한다. [사진 프록시](src/app/storage/route.ts) · [개발용 S3 설정](../../infra/compose.s3.yml)

사진을 선택하면 가입 화면은 먼저 `POST /api/users/photo-upload`로 업로드 조건을 받는다. `photoUrl(upload.url)`은 발급된 URL을 웹 앱의 `/storage` 경로에 `url` 쿼리 값으로 담는다. 업로드가 성공해야 다음 가입 요청에 사진 ID를 넣는다. [사진 업로드](src/lib/photos.ts) · [가입 화면](src/app/signup/page.tsx)

```ts
const body = new FormData()
for (const [key, value] of Object.entries(upload.fields)) body.append(key, value)
body.append('file', file)
const response = await fetch(photoUrl(upload.url), { method: upload.method, body })
if (!response.ok) throw new Error('사진 업로드에 실패했습니다. 회원가입은 진행되지 않았습니다.')
return upload.assetId
```

## 브라우저 E2E

`pnpm -C apps/web test`는 프로덕션 빌드를 Chromium으로 검증한다. 브라우저가 HTTP로 접속해도 Web Crypto를 사용할 수 있도록 Chromium이 `web.localhost`를 웹 컨테이너로 연결한다. [E2E 환경](tests/compose.e2e.yml) · [브라우저 설정](tests/playwright.config.ts)
