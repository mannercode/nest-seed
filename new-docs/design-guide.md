# REST API & 엔티티 설계

## 1. 리소스 중심 설계

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

---

## 2. 긴 쿼리 파라미터

쿼리 파라미터가 길어질 수 있는 API는 POST 방식으로 정의한다.

```
POST /showtimes/search
{
    "theaterIds": [...]
}
```

---

## 3. 비동기 요청

처리 시간이 오래 걸리는 작업은 202 Accepted를 반환하고 비동기로 처리한다. 진행 상황은 SSE로 클라이언트에 전달할 수 있다.

```
POST /some-resource        → 202 Accepted { taskId }
SSE  /some-resource/events → { status, taskId }
```

---

## 4. API 단수/복수 설계

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

## 5. 에러 메시지

- **언어 중립적인 code**를 반드시 포함한다. 다국어 지원은 클라이언트 책임이다.
- `message`는 참고용으로 간단히 기술한다.
- HTTP Status가 **4xx 범위일 때만** code를 포함한다. 5xx는 서버 장애이므로 클라이언트에 상세 원인을 노출하지 않는다.

---

## 6. 데이터 비정규화

조회 성능과 **계층 간 결합 감소**를 위해 적절히 비정규화한다.

`Ticket`에 `movieId`·`theaterId`를 중복 저장하는 것이 대표적인 예다. 이 값들은 `Showtime`에도 존재하지만, 중복 저장하지 않으면 조회 시마다 `ShowtimesService`를 호출해야 한다.

---

## 7. Entity vs Value Object

도메인 맥락에 따라 같은 개념이라도 Entity가 될 수도, Value Object가 될 수도 있다.

`Theater.seatmap`은 티켓 생성을 위한 템플릿이다. 고객은 `Block`·`Row`·`Number`로 좌석을 찾을 뿐 좌석 ID는 필요 없으므로 Value Object로 정의한다.

---

## 8. sagaId

비동기 대량 작업이 필요한 경우, 추적과 취소를 위해 관련 엔티티에 `sagaId` 속성을 추가할 수 있다.
