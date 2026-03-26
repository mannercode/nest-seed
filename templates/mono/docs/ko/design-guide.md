> [English](../en/design-guide.md) | **한국어**

# 백엔드 설계 가이드

---

## 1. 서비스 아키텍처 — SoLA (Service-oriented Layered Architecture)

### 1.0. 시스템 개요

```
Client ── HTTP ──▶ Gateway ──┬──▶ Applications     (비즈니스 로직, 비동기 작업)
                             ├──▶ Cores             (도메인 모델, 데이터 영속성)
                             └──▶ Infrastructures   (외부 서비스 연동)
```

| Layer               | Role                              | Domains                                                                                       |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| **Gateway**         | API 진입점, 인증(JWT/Local)       | Customers, Movies, Theaters, Booking, Purchase, ShowtimeCreation                              |
| **Applications**    | 비즈니스 오케스트레이션           | ShowtimeCreation, Booking, Purchase, Recommendation                                           |
| **Cores**           | 핵심 도메인 엔터티, 데이터 영속성 | Customers, Movies, Theaters, Showtimes, Tickets, TicketHolding, PurchaseRecords, WatchRecords |
| **Infrastructures** | 외부 서비스 통합                  | Payments, Assets(MinIO)                                                                       |

| Component   | Configuration                                     |
| ----------- | ------------------------------------------------- |
| **MongoDB** | 3-node replica set (27017-27019)                  |
| **Redis**   | 6-node cluster, 3 primary + 3 replica (6379-6384) |
| **MinIO**   | S3-compatible object storage (9000, console 9001) |

### 1.1. 문제: 순환 참조

모듈(또는 서비스) 간 참조에 제약이 없으면, 처음에는 A → B 단방향이었던 관계가 기능 확장 과정에서 B → A 참조가 추가되어 순환 참조로 발전할 수 있다. 이렇게 되면 둘은 사실상 하나로 묶인다. A를 변경하면 B가 영향을 받고, B를 변경하면 다시 A가 영향을 받는다.

### 1.2. 해결: 계층 분리

이 프로젝트에서는 모듈을 세 계층으로 나누고, 순환 참조를 원천적으로 방지한다. 이 구조를 SoLA(Service-oriented Layered Architecture)라 부른다.

SoLA는 본래 마이크로서비스 아키텍처(MSA)를 대상으로 설계되었다. MSA에서는 서비스가 물리적으로 분리되어 있어 같은 계층 간 직접 참조가 불가능하고, 서비스 조합은 오케스트레이터나 API Gateway가 담당한다. SoLA는 이 격리 원칙을 모놀리스 안에서 모듈 단위로도 적용할 수 있다.

모놀리스에서 SoLA를 적용하는 이유는 서비스가 성장하면 MSA로 전환할 수 있기 때문이다. 모놀리스 단계에서부터 모듈 간 격리를 유지하면, 나중에 특정 모듈을 독립 서비스로 분리할 때 코드 레벨의 의존성을 끊는 비용이 최소화된다. 단, MSA 전환에는 네트워크 호출, 분산 트랜잭션, 데이터 일관성 등 코드 분리 외의 비용이 별도로 존재한다.

일반적인 레이어드 아키텍처는 상위 → 하위 참조만 금지하고 같은 계층 간 참조는 허용한다. 그러나 SoLA는 **동일 계층 간 참조도 금지**한다. 같은 계층의 모듈끼리 참조를 허용하면 결국 순환 참조로 발전할 수 있기 때문이다. 여러 모듈을 조합해야 하는 경우에는 반드시 상위 계층에서 조립한다.

```
┌─────────────────────────────────────────┐
│         Application Services            │  유스케이스 조립, 트랜잭션 관리
│  ShowtimeCreation, Booking, Purchase    │
├─────────────────────────────────────────┤
│            Core Services                │  도메인 기본 로직
│  Movies, Theaters, Showtimes, Tickets   │
├─────────────────────────────────────────┤
│        Infrastructure Services          │  외부 시스템 연동
│           Payments, Assets              │
└─────────────────────────────────────────┘
```

**의존 규칙**:

1. **동일 계층 간 참조 금지** — 같은 계층의 서비스끼리는 서로를 알지 못한다
2. 상위 계층만 하위 계층을 참조 가능 (Application → Core → Infrastructure, 화살표는 참조 방향)
3. 하위 계층은 상위 계층을 알지 못한다

### 1.3. 각 계층의 역할

| 계층               | 역할                                                                                        | 참조 가능 대상       |
| ------------------ | ------------------------------------------------------------------------------------------- | -------------------- |
| **Application**    | 사용자 시나리오를 조립한다 (예: 상영시간 생성 → 티켓 생성). 트랜잭션 관리를 주도한다.       | Core, Infrastructure |
| **Core**           | 도메인의 기본 로직을 담당한다 (예: 영화 관리, 극장 관리). 각 서비스는 자신의 DB만 소유한다. | Infrastructure       |
| **Infrastructure** | 결제, 스토리지 등 외부 시스템 연동을 담당한다.                                              | 없음                 |

Application · Domain · Infrastructure 레이어로 객체를 분류하듯이, 모듈 전체도 동일한 원리로 계층을 나누는 것이다.

### 1.4. Application Service 설계

Application Service는 **여러 Core Service를 조합해야 하는 경우**에만 만든다. 단일 Core Service로 처리 가능한 API는 컨트롤러에서 Core Service를 직접 호출한다.

```
# Application Service가 필요한 경우 — 여러 Core를 조합하는 유스케이스
ShowtimeCreationService   → ShowtimesService + MoviesService + TheatersService + TicketsService
BookingService            → ShowtimesService + TicketsService + TicketHoldingService
PurchaseService           → TicketsService + PurchaseRecordsService + PaymentsService

# Application Service가 불필요한 경우 — 단일 Core로 충분
GET /movies/:id           → MoviesService.getMany()
POST /theaters            → TheatersService.create()
```

Application Service는 오케스트레이터 역할에 충실한다. 비즈니스 로직이 복잡해지면 내부 클래스로 책임을 분산시킨다.

#### 1.4.1. 컨트롤러의 서비스 주입

하나의 리소스 컨트롤러가 Core Service와 Application Service를 함께 주입할 수 있다. 단순 CRUD는 Core Service를, 여러 도메인을 조합하는 API는 Application Service를 호출한다.

```ts
@Controller('showtimes')
export class ShowtimesHttpController {
    constructor(
        private readonly showtimesService: ShowtimesService, // Core
        private readonly showtimeCreationService: ShowtimeCreationService // Application
    ) {}

    @Get(':showtimeId')
    async get(@Param('showtimeId') showtimeId: string) {
        return this.showtimesService.getMany([showtimeId]) // 단순 조회 → Core 직접
    }

    @Post()
    async create(@Body() body: CreateShowtimesDto) {
        return this.showtimeCreationService.create(body) // 조합 필요 → Application
    }
}
```

단, 복합 유스케이스가 여러 API로 구성되어 독립된 진입점이 필요한 경우에는 별도 컨트롤러와 namespace로 분리할 수 있다 (2.1 참조).

---

## 2. REST API 설계

### 2.1. 리소스 중심 설계

REST API는 **리소스 중심**으로 설계한다. URL 경로는 도메인 리소스를 기준으로 구성하며, 리소스 간 관계는 중첩 경로로 표현한다.

```
GET    /movies                    리소스 목록
GET    /movies/:id                리소스 조회
POST   /movies                    리소스 생성
PATCH  /movies/:id                리소스 수정
DELETE /movies/:id                리소스 삭제
GET    /movies/:id/showtimes      하위 리소스 조회
```

**복합 유스케이스**에는 namespace를 사용할 수 있다. 복합 유스케이스란 하나의 상위 유스케이스가 여러 하위 유스케이스로 분해되고, 각 하위 유스케이스가 개별 API로 대응되는 경우를 말한다. 이때 하위 API들은 해당 유스케이스 맥락 밖에서는 단독으로 사용되지 않는다.

```
# 복합 유스케이스 — namespace 사용
# "티켓 예매하기" = 상영관 검색 → 상영일 검색 → 상영시간 검색 → 좌석 조회 → 좌석 홀드
GET  /booking/movies/:id/theaters
GET  /booking/movies/:id/theaters/:id/showdates
GET  /booking/movies/:id/theaters/:id/showdates/:date/showtimes
GET  /booking/showtimes/:id/tickets
POST /booking/showtimes/:id/tickets/hold

# 단일 리소스 — namespace 미사용
# 상영시간 조회는 예매 맥락 밖에서도 독립적으로 사용 가능
GET  /showtimes/:id
```

단일 리소스 CRUD나, 다른 맥락에서도 독립적으로 의미가 있는 API에는 namespace를 사용하지 않는다.

### 2.2. 긴 쿼리 파라미터

쿼리 파라미터가 길어질 수 있는 API는 POST 방식으로 정의한다.

```
POST /showtimes/search
{
    "theaterIds": [...]
}
```

### 2.3. 비동기 요청

처리 시간이 오래 걸리는 작업은 202 Accepted를 반환하고 비동기로 처리한다. 진행 상황은 SSE로 클라이언트에 전달할 수 있다.

```
POST /some-resource        → 202 Accepted { taskId }
SSE  /some-resource/events → { status, taskId }
```

---

## 3. 엔티티 설계

### 3.1. 데이터 비정규화

조회 성능과 **계층 간 결합 감소**를 위해 적절히 비정규화한다.

`Ticket`에 `movieId`·`theaterId`를 중복 저장하는 것이 대표적인 예다. 이 값들은 `Showtime`에도 존재하지만, 중복 저장하지 않으면 조회 시마다 `ShowtimesService`를 호출해야 한다.

### 3.2. Entity vs Value Object

도메인 맥락에 따라 같은 개념이라도 Entity가 될 수도, Value Object가 될 수도 있다.

`Theater.seatmap`은 티켓 생성을 위한 템플릿이다. 고객은 `Block`·`Row`·`Number`로 좌석을 찾을 뿐 좌석 ID는 필요 없으므로 Value Object로 정의한다.

### 3.3. sagaId

비동기 대량 작업이 필요한 경우, 추적과 취소를 위해 관련 엔티티에 `sagaId` 속성을 추가할 수 있다.

---

## 4. 서비스 호출 흐름

REST API 호출은 HTTP 컨트롤러가 서비스를 직접 주입받아 실행한다.

```
┌──────────────────────────┐        ┌──────────────────────────┐
│    HTTP Controller       ├───────>│         Service          │
└──────────────────────────┘        └──────────────────────────┘
```

```
src/
├── controllers/
│   └── movies.http-controller.ts
│
└── cores/
    └── services/
        └── movies/
            └── movies.service.ts
```

---

## 5. 서비스 이름 규칙

프로세스 중심 서비스는 단수형, 엔티티 관리 서비스는 복수형으로 명명한다.

| 유형               | 예시                                | 설명                 |
| ------------------ | ----------------------------------- | -------------------- |
| 프로세스 (단수)    | `BookingService`, `PurchaseService` | 특정 프로세스를 처리 |
| 엔티티 관리 (복수) | `MoviesService`, `TheatersService`  | 엔티티 CRUD 담당     |

`Service` suffix는 **다른 서비스를 직접 호출해 스스로 처리하는 경우**에만 붙인다. 필요한 데이터를 호출자에게 전달받아 계산만 수행하는 경우에는 suffix를 붙이지 않는다.

```
ShowtimeBulkValidatorService  ← Showtimes/Movies/Theaters 서비스를 직접 호출
ShowtimeBulkValidator         ← 호출자가 데이터를 주입하면 검증 계산만 수행
```

---

## 6. API 단수/복수 설계

id만 전달하는 조회·삭제 API는 처음부터 **복수형**으로 설계한다. 나중에 복수 처리가 필요해져서 API를 변경하는 것을 방지한다.

```ts
// id만 받는 API — 복수형
getMany(theaterIds: string[]) {}
deleteMany(theaterIds: string[]) {}

// 생성·업데이트 — 단일
create(createDto: CreateTheaterDto) {}
update(updateDto: UpdateTheaterDto) {}
```

REST API에서 단일 요청이 필요한 경우, Gateway Controller에서 배열로 감싸서 호출한다.

```ts
@Get(':theaterId')
async getTheater(@Param('theaterId') theaterId: string) {
    return this.theatersService.getMany([theaterId])
}
```

---

## 7. 에러 메시지

- **언어 중립적인 code**를 반드시 포함한다. 다국어 지원은 클라이언트 책임이다.
- `message`는 참고용으로 간단히 기술한다.
- HTTP Status가 **4xx 범위일 때만** code를 포함한다. 5xx는 서버 장애이므로 클라이언트에 상세 원인을 노출하지 않는다.

---
