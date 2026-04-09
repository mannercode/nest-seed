# Kong 도입 작업 계획 — Phase 1: Gateway 해체

> **상태: Phase 1 완료.** Phase 2~5(인증 이관, CORS/Rate limit, 로깅, Health check 위임)는 미착수.
>
> apis/msa의 NestJS Gateway를 제거하고, Kong이 각 마이크로서비스(applications / cores / infrastructures)로 직접 라우팅하도록 전환한다.
>
> 이 문서는 5단계 Kong 도입 로드맵 중 **소스 영향이 가장 큰 1단계**의 실행 계획이다. (전체 로드맵: 1. Gateway 해체 → 2. 인증 이관 → 3. CORS/Rate limit 이관 → 4. 로깅/메트릭 이관 → 5. Health check 위임)

---

## 1. 목표와 전제

### 목표

- [apis/msa/src/apps/gateway/](apis/msa/src/apps/gateway/) 디렉토리와 `gateway` 컨테이너를 제거한다.
- 외부 HTTP 진입점은 Kong이 담당한다.
- `applications`, `cores`, `infrastructures` 각 서비스가 HTTP 컨트롤러를 직접 노출한다.
- 기존 NATS `MessagePattern` 기반 내부 통신은 **유지**한다 (서비스 간 통신용).

### 전제 / 비목표

- **인증/인가는 이 단계에서는 옮기지 않는다.** Guard 로직은 각 서비스 HTTP 컨트롤러 쪽으로 그대로 따라간다. Kong JWT 플러그인 이관은 Phase 2.
- **NATS 메시징 자체는 제거하지 않는다.** 외부 → 서비스는 HTTP, 서비스 → 서비스는 NATS.
- 클라이언트(브라우저/모바일) API 경로는 가능한 한 유지한다 (예: `POST /customers/login`).

### 영향 범위 요약

| 항목                                                                     | 변경                                      |
| ------------------------------------------------------------------------ | ----------------------------------------- |
| [apis/msa/src/apps/gateway/](apis/msa/src/apps/gateway/)                 | **삭제**                                  |
| [apis/msa/src/apps/cores/](apis/msa/src/apps/cores/)                     | HTTP 컨트롤러 추가                        |
| [apis/msa/src/apps/applications/](apis/msa/src/apps/applications/)       | HTTP 컨트롤러 추가                        |
| [apis/msa/src/apps/infrastructures/](apis/msa/src/apps/infrastructures/) | (필요 시) HTTP 컨트롤러 추가              |
| [apis/msa/compose.yml](apis/msa/compose.yml)                             | `gateway` 서비스 제거, `kong` 서비스 추가 |
| 라우팅 정책                                                              | Kong declarative config (`kong.yml`) 신규 |

---

## 2. 현재 상태 분석

### Gateway가 노출하는 컨트롤러

[apis/msa/src/apps/gateway/controllers/](apis/msa/src/apps/gateway/controllers/) 기준 7개 HTTP 컨트롤러:

| 컨트롤러                         | 호출 대상 NATS Client                   | 이전 위치    |
| -------------------------------- | --------------------------------------- | ------------ |
| `CustomersHttpController`        | `CustomersClient` (cores)               | cores        |
| `MoviesHttpController`           | `MoviesClient` (cores)                  | cores        |
| `TheatersHttpController`         | `TheatersClient` (cores)                | cores        |
| `BookingHttpController`          | `BookingClient` (applications)          | applications |
| `PurchaseHttpController`         | `PurchaseClient` (applications)         | applications |
| `ShowtimeCreationHttpController` | `ShowtimeCreationClient` (applications) | applications |
| (recommendation)                 | `RecommendationClient` (applications)   | applications |

### Gateway가 가진 추가 책임

- 인증 가드 3종 — Phase 2에서 제거 예정, **이번 단계에서는 도착 서비스로 이전**.
- `HealthModule` — 각 서비스에 이미 health 엔드포인트 존재 가능성. 확인 필요.
- `CommonModule` — 공통 부트스트랩. 변경 없음.

### 컨트롤러 동작의 핵심 패턴

[customers.http-controller.ts:32-34](apis/msa/src/apps/gateway/controllers/customers.http-controller.ts#L32-L34)

```ts
async create(@Body() createDto: CreateCustomerDto) {
    return this.customersClient.create(createDto)
}
```

대부분의 핸들러가 `*Client.method(dto)` 한 줄짜리 위임이다. 이 위임이 사라지고 컨트롤러가 **`*Service`를 직접 호출**하면 된다.

---

## 3. 단계별 실행 계획

### Step 1. Kong 인프라 준비 (소스 변경 없음)

- [x] [apis/msa/compose.yml](../../apis/msa/compose.yml)에 `kong` 서비스 추가 (DB-less 모드, declarative config)
- [x] [apis/msa/kong/kong.yml](../../apis/msa/kong/kong.yml) 신규 작성 (라우트는 비어 있어도 OK, 추후 채움)
- [x] `kong` → `applications` / `cores` / `infrastructures` 로의 네트워크 연결 확인
- [x] 외부 노출 포트를 `gateway` 대신 `kong`이 받도록 준비 (아직 트래픽은 보내지 않음)

**검증:** `docker compose up`으로 Kong이 정상 기동되고 admin API가 응답하는지 확인.

### Step 2. 각 서비스에 HTTP 컨트롤러 추가 (gateway는 아직 살아 있음)

서비스 한 개씩 다음을 반복:

#### 2-a. cores

- [x] [cores/services/customers/](../../apis/msa/src/apps/cores/services/customers/)에 `customers.http-controller.ts` 추가
    - `CustomersHttpController`의 라우트 구조를 그대로 복사
    - `CustomersClient` 의존을 `CustomersService` 직접 호출로 치환
    - 가드는 일단 그대로 따라옴 (Phase 2에서 제거)
- [x] 동일 작업: `movies`, `theaters`
- [x] [cores.module.ts](../../apis/msa/src/apps/cores/cores.module.ts)에 새 컨트롤러 등록
- [x] [cores/main.ts](../../apis/msa/src/apps/cores/main.ts)에서 HTTP 어댑터(NestExpress) 활성화 — 현재 NATS-only인지 hybrid인지 확인 후 hybrid로 변경

#### 2-b. applications

- [x] `booking`, `purchase`, `showtime-creation`, `recommendation`에 동일하게 HTTP 컨트롤러 추가
- [x] 모듈 등록 + main.ts hybrid 전환

#### 2-c. infrastructures

- [x] 외부 노출 엔드포인트가 있는 경우만 추가 (현재 gateway가 라우팅하지 않으면 skip)

**검증 (서비스별):**

- 새 HTTP 포트로 직접 curl → 정상 응답
- 기존 gateway 경로도 여전히 동작 (회귀 없음)
- 단위/통합 테스트 통과

### Step 3. Kong 라우트 설정 및 트래픽 전환

- [x] `kong.yml`에 services + routes 정의
    ```yaml
    services:
        - name: cores
          url: http://cores:PORT
          routes:
              - name: customers
                paths: [/customers]
              - name: movies
                paths: [/movies]
              - name: theaters
                paths: [/theaters]
        - name: applications
          url: http://applications:PORT
          routes:
              - name: booking
                paths: [/booking]
              - name: purchase
                paths: [/purchase]
              - name: showtime-creation
                paths: [/showtime-creation]
    ```
- [x] 외부 진입 포트를 gateway → Kong으로 전환
- [x] **E2E 테스트 전체 통과 확인**
- [ ] 스테이징/프로덕션은 별도 cutover 계획 필요 (이 문서 범위 외)

### Step 4. Gateway 제거

- [x] [apis/msa/src/apps/gateway/](../../apis/msa/src/apps/) 디렉토리 삭제
- [x] [apis/msa/compose.yml](../../apis/msa/compose.yml)에서 `gateway` 서비스 / `api-setup`의 `gateway` 의존 제거
- [x] [apis/msa/src/apps/](../../apis/msa/src/apps/)의 build target 목록(`TARGET_APP=gateway`)에서 gateway 제거
- [x] gateway에서만 쓰던 NATS Client 클래스(`BookingClient`, `PurchaseClient`, `CustomersClient` 등) 사용처 점검 — **다른 서비스가 서비스 간 호출용으로 쓰고 있을 수 있음**. 사용처 0이면 삭제, 아니면 유지.
- [x] gateway 전용 테스트 ([apis/msa/src/apps/**tests**/](../../apis/msa/src/apps/__tests__/))를 새 위치에 맞게 이동/재작성

**검증:** 전체 빌드 + 전체 테스트 + E2E 통과.

---

## 4. 위험 요소와 대응

| 위험                                                        | 영향                        | 대응                                                           |
| ----------------------------------------------------------- | --------------------------- | -------------------------------------------------------------- |
| 서비스가 HTTP+NATS hybrid로 변하면서 부팅 흐름이 바뀜       | 기동 실패                   | Step 2에서 서비스 1개씩 검증 후 다음 진행                      |
| `BookingClient` 등을 다른 서비스가 의존하고 있음            | gateway 제거 시 컴파일 에러 | Step 4 직전에 grep으로 사용처 전수 조사                        |
| 인증 가드가 service 측에서 깨짐 (passport strategy 위치 등) | 401 회귀                    | 가드와 strategy를 한 묶음으로 같이 이동                        |
| 외부 클라이언트의 baseURL/경로 변경 필요                    | 클라이언트 호환성           | 경로 prefix는 유지. Kong이 그대로 패스스루                     |
| 각 서비스가 외부에 노출되어 공격면 확대                     | 보안                        | Kong 외 포트는 docker network 내부로만 노출, 외부 publish 금지 |
| Health check 경로 충돌                                      | 헬스체크 실패               | 각 서비스의 `/health`를 Kong의 active healthcheck로 등록       |

---

## 5. 완료 정의 (Definition of Done)

- [x] [apis/msa/src/apps/gateway/](../../apis/msa/src/apps/) 디렉토리가 존재하지 않는다.
- [x] [apis/msa/compose.yml](../../apis/msa/compose.yml)에 `gateway` 서비스가 없고 `kong` 서비스가 있다.
- [x] Kong 경유로 기존 7개 컨트롤러의 모든 엔드포인트가 동작한다.
- [x] 기존 E2E 테스트 스위트가 Kong 경유 baseURL로 모두 통과한다.
- [x] 인증 흐름(login / refresh / JWT 보호 엔드포인트)이 회귀 없이 동작한다.
- [x] 새 구조에 맞춰 [docs/tech-stack.md](../tech-stack.md)와 관련 설계 문서가 업데이트되어 있다.

---

## 6. 다음 단계 (Phase 2 예고)

Phase 1이 끝나면 각 서비스 컨트롤러에 `@UseGuards(CustomerJwtAuthGuard)`가 그대로 붙어 있는 상태가 된다. Phase 2에서는:

1. Kong JWT 플러그인 (또는 OIDC) 활성화
2. Kong이 검증한 토큰의 클레임을 `X-Consumer-*` 헤더로 다운스트림 전달
3. NestJS Guard를 헤더 기반 경량 가드로 교체 또는 제거
4. `login` / `refresh` 엔드포인트는 Kong 우회(또는 별도 route)로 유지
