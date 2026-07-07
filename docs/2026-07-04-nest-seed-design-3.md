---
layout: post
title: 백엔드 서비스 분석과 설계 — nest-seed로 증명하기 (3)
lang: ko
---

지난 시간에 `/showtime-creation` 네임스페이스로 REST API를 설계했고, 서비스끼리 자유롭게 부르게 두면 언젠가 순환 참조로 발전한다는 문제를 확인하며 끝냈다.

이번 시간에는 그 문제를 계층으로 풀고, 엔티티를 정의하고, 최우선 요구사항의 숫자를 대입해서 API 계약을 바꾼다. 그리고 이번 편에는 문서 위에서는 그럴듯해 보이지만 실행 앞에서 갈리는 결정이 둘 나온다 — 동시성 장치와 충돌 검사 알고리즘이다. 결정마다 [nest-seed](https://github.com/mannercode/nest-seed)의 실물을 열어 어느 쪽이 서 있는지 확인한다.

## 1. 서비스 배치 — SoLA

문제부터 다시 보자. `ShowtimesService`가 검증을 위해 `MoviesService`를 부르는 것은 자연스러워 보인다. 그런데 나중에 "23시 이후에 상영하는 영화 목록" 기능이 생기면 이번에는 `MoviesService`가 `ShowtimesService`를 부른다.

{% plantuml %}
@startuml
participant MoviesService as movies
participant ShowtimesService as showtimes

group 상영시간 생성 — Showtimes가 Movies를 부른다
showtimes -> movies: moviesExist(movieId)
end
group 23시 이후 상영 영화 — Movies가 Showtimes를 부른다
movies -> showtimes: searchShowtimes()
end
note over movies, showtimes: 서로를 부르는 순간 두 서비스는 한 덩어리가 된다
@enduml
{% endplantuml %}

두 서비스가 서로를 부르면 한쪽을 고칠 때 다른 쪽이 흔들리고, 사실상 한 객체로 묶인다. 기능이 늘수록 이런 결합은 반드시 생긴다. 개별 사례를 코드 리뷰로 막는 것은 오래 못 간다. 구조로 막아야 한다.

SoLA(Service-oriented Layered Architecture)는 이 문제를 규칙 두 개로 막는다.

1. **같은 계층의 모듈끼리 직접 부르지 않는다.**
2. 두 모듈을 함께 써야 한다면, 둘을 모두 부를 수 있는 **한 단계 위 계층에 조립용 모듈**을 만든다.

흔한 레이어드 아키텍처는 위아래 방향만 제한하고 같은 계층 안에서는 서로 부르게 둔다. 그래서 Service 계층 안에서 순환 참조가 다시 생긴다. SoLA는 같은 계층 안의 호출까지 금지한다는 점에서 한 걸음 더 나간다.

이 규칙을 적용하면 "상영시간 생성"처럼 영화·극장·상영시간·티켓을 한꺼번에 다루는 유스케이스는 Core 위 계층(Application)의 `ShowtimeCreationService`가 되고, Core의 `MoviesService`와 `TheatersService`는 서로를 모른 채 각자의 도메인만 지킨다.

### 1.1. Application은 유스케이스 계층이 아니다

여기서 흔한 오해를 하나 짚고 가자. Application 계층이 생겼으니 모든 유스케이스가 Application을 거쳐야 한다고 생각하기 쉽다. 그러면 극장 등록처럼 Core 하나로 끝나는 요청에도 Core를 한 줄씩 감싸는 통과 계층이 생긴다. 아무 판단도 하지 않고 호출을 전달만 하는 클래스가 도메인 수만큼 늘어나는 것이다.

Application은 **조립할 게 있을 때만** 만든다. nest-seed의 Application 모듈은 정확히 4개다.

- `showtime-creation` — 영화·극장·상영시간·티켓 조합
- `booking` — 예매·좌석 선점
- `purchase` — 구매·결제·티켓 전이(보상 포함)
- `recommendation` — 관람 기록과 상영 정보를 조합한 영화 추천

단일 도메인으로 끝나는 유스케이스(영화 등록, 가입·로그인)는 컨트롤러가 Core를 직접 호출한다. [movies.http-controller.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway/movies.http-controller.ts)가 `MoviesService`를 바로 부르는 것과 [showtime-creation.http-controller.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway/showtime-creation.http-controller.ts)가 Application을 거치는 것이 그 대비다.

### 1.2. 컨트롤러는 Gateway 계층으로 모은다

NestJS에 익숙하다면 낯선 점이 하나 보일 것이다. 컨트롤러가 feature 모듈 안에 없다. NestJS 관례는 movies 모듈 안에 MoviesController를 두지만, nest-seed는 컨트롤러 전부를 Gateway 계층([src/services/gateway/](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway))으로 분리했다.

컨트롤러는 HTTP라는 특정 진입 방식에 묶인 코드다. 이것을 feature 모듈 안에 두면 모듈이 HTTP에 묶인다. 진입을 Gateway로 모아 두면 feature 모듈은 HTTP를 모르고, 나중에 특정 모듈을 독립 서비스로 떼어낼 때 경계만 끊으면 된다.

그래서 전체는 5계층이 된다. 의존은 단방향이다.

```txt
Gateway         HTTP 진입 (컨트롤러·가드·파이프)
View            화면 전용 읽기 조합 (이번 편의 흐름에는 등장하지 않는다)
Application     여러 Core를 묶는 유스케이스
Core            도메인 로직, 자기 컬렉션 소유
Infrastructure  결제·스토리지 등 외부 시스템 연동
```

이 규칙은 문서에 적어두고 지키자고 다짐하는 것이 아니라 [eslint-plugin-boundaries](https://github.com/mannercode/nest-seed/blob/main/apps/api/eslint.config.js)로 강제한다. 아래 계층이 위 계층을 import하거나 같은 계층의 이웃 모듈을 import하면 lint가 실패한다. 규칙은 어겨지는 순간 걸려야 규칙이다.

### 1.3. 실물 배치

이 배치는 설계 문서에만 있는 그림이 아니다. 아래 다이어그램의 모든 이름이 nest-seed의 실제 클래스이고, 패키지 이름이 실제 폴더 경로다.

{% plantuml %}
@startuml
skinparam componentStyle rectangle
top to bottom direction
actor administrator as admin

package "Gateway — src/services/gateway" {
[ShowtimeCreationHttpController] as ctrl
}
package "Application — src/services/application/showtime-creation" {
[ShowtimeCreationService] as svc
package "internal/ — 모듈 밖에서는 보이지 않는다" {
[ShowtimeCreationOrchestratorService] as orch
[ShowtimeBulkValidatorService] as validator
[ShowtimeBulkCreatorService] as creator
}
}
package "Core — src/services/core" {
[MoviesService] as movies
[TheatersService] as theaters
[ShowtimesService] as showtimes
[TicketsService] as tickets
}

admin --> ctrl : POST /showtime-creation/showtimes
ctrl --> svc
svc --> orch
orch ..> validator
orch ..> creator
note on link
조율자는 Temporal 워크플로를 시작하고,
워크플로가 검증·생성을 호출한다 (3장)
end note
validator --> movies
validator --> theaters
validator --> showtimes
creator --> theaters : 좌석 배치 조회
creator --> showtimes
creator --> tickets
@enduml
{% endplantuml %}

Core 서비스들 사이에 화살표가 하나도 없다는 점을 보라. 조합은 전부 위 계층의 몫이다.

`internal/` 상자가 이 그림의 또 다른 요점이다. 조율·검증·생성으로 분해된 내부 서비스들은 [showtime-creation/internal/](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/showtime-creation/internal)에 살고, 모듈의 공개 barrel(index.ts 재수출 목록)로 내보내지 않는다. 모듈 밖에 공개되는 서비스는 `ShowtimeCreationService`와 SSE 이벤트 통로인 `ShowtimeCreationEvents` 둘뿐이다. 상영시간 생성이 내부에서 몇 개의 클래스로 쪼개져 있는지는 경계 밖에서 알 필요가 없고, 알 수 없어야 내부를 마음껏 리팩토링할 수 있다.

이 내부 클래스들이 각각 무슨 일을 하는지는 3장에서 규모 문제를 풀면서 하나씩 등장한다.

참고로 SoLA는 원래 마이크로서비스 — 서비스가 서로 다른 프로세스로 실행되는 환경 — 를 염두에 둔 원칙이지만, nest-seed는 같은 경계를 모놀리스 안에 모듈 단위로 적용했다. 경계가 코드에 있으면 배포 형태는 나중에 바꿀 수 있다. 반대로 경계 없이 배포만 쪼개면 분산된 진흙 덩어리가 된다.

## 2. 엔티티 정의하기

`상영시간 생성 요청`은 `Showtime`과 `Ticket` 엔티티를 생성한다. 따라서 설계를 진행하려면 엔티티부터 정의해야 한다. 아래는 nest-seed의 실물 스키마를 옮긴 것이다.

{% plantuml %}
@startuml
class Movie {
id: string
title: string
genres: MovieGenre[] {Action, Horror, ...}
releaseDate: Date
plot: string
durationInSeconds: number
director: string
rating: MovieRating {G, PG13, R, NC17, ...}
isPublished: boolean
assetIds: string[]
}

class Theater {
id: string
name: string
location: TheaterLocation {latitude, longitude}
seatmap: Seatmap
}
note left of Theater::seatmap
Seatmap {
blocks: [{
name: 'A',
rows: [{
name: '1',
layout: 'OOOOXXOOOO'
}]
}]
}
end note

class Showtime {
id: string
startTime: Date
endTime: Date
theaterId: string
movieId: string
}

class Ticket {
id: string
showtimeId: string
theaterId: string
movieId: string
status: TicketStatus {Available, Sold}
seat: SeatPosition {block, row, seatNumber}
}

Ticket "_" --> "1" Showtime
Ticket "_" --> "1" Movie
Ticket "_" --> "1" Theater
Showtime "_" --> "1" Movie
Showtime "\*" --> "1" Theater
@enduml
{% endplantuml %}

실물 스키마에는 여기 없는 속성이 하나 더 있는데(`sagaId`), 3장에서 그 속성이 왜 필요한지와 함께 추가한다.

### 2.1. `Movie` 엔티티

`Movie`의 속성은 대부분 도메인 전문가에게 들을 수 있다. 이미지 파일은 직접 담지 않고 `assetIds`로 참조만 한다. 파일 저장은 Infrastructure 계층의 Assets 서비스가 맡고 영화는 그 ID만 들고 있다. `isPublished`는 필수 정보가 아직 없는 초안 상태의 영화를 저장할 수 있게 하는 속성이다.

상영 길이는 `durationInSeconds`, 즉 초 단위로 저장한다. 그런데 뒤에 나오는 상영시간 생성 입력은 `durationInMinutes`다. 저장은 정밀하게, 입력은 사람에게 자연스럽게 — 관리자가 상영시간을 초 단위로 입력할 일은 없다.

### 2.2. `Theater` 엔티티 — 좌석에는 ID가 없다

`location`은 극장의 위도·경도다. 요구사항이 확장되면 주소 등 다른 위치 정보가 추가될 수 있어서 처음부터 객체로 묶었다.

`seatmap`을 보자. 주석의 형태를 보면 `blocks`나 `rows`에 `id`가 없다. 좌석은 `layout` 문자열에서 O와 X로 존재 여부만 표현한다([seatmap.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/core/theaters/models/seatmap.ts)).

좌석에 ID가 없어도 괜찮은 걸까? 각각의 좌석은 고유하다. 아마 좌석 어딘가에 일련번호가 붙어있을지도 모른다. 그러면 DB에서도 ID를 부여하고 관리해야 하는 것 아닐까?

그러나 이 프로젝트는 영화 예매 시스템이다. 고객은 티켓에 적힌 블록·행·번호로 좌석을 찾을 뿐 좌석 ID는 아무 데도 쓰이지 않는다. `seatmap`은 티켓을 생성하기 위한 템플릿이지 그 자체가 관리 대상이 아니다. **관리 대상이 아니면 ID를 주지 않는다.** ID 없이 값 자체로만 의미를 갖는 값 객체(Value Object)로 충분하다.

만약 좌석마다 정비 이력을 남기는 시설 관리 시스템이라면 좌석에 ID를 부여했을 것이다. 같은 좌석이라도 시스템의 목적에 따라 엔티티가 되기도 하고 값이 되기도 한다.

이 판단은 아직 AI에게 어려운 일인 것 같다. `ChatGPT o3`와 `Gemini 2.5 Pro`에 엔티티 설계를 요청해 봤더니 둘 다 `Seat`를 엔티티로 설계했다. 좌석이 엔티티가 되면 좌석 수만큼 행이 생기고, 프로젝트 후반에 성능 문제로 되돌아온다. 극장이 4,000개라는 것을 잊으면 안 된다.

### 2.3. `Showtime` 엔티티

`Showtime`은 언제(`startTime`, `endTime`), 어디서(`theaterId`), 무엇을(`movieId`) 상영하는지를 나타내는 상영 회차 엔티티다([showtime.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/core/showtimes/models/showtime.ts)).

### 2.4. `Ticket` 엔티티 — 중복 데이터를 허용한다

`Ticket`은 `showtimeId`와 함께 `movieId`·`theaterId`를 갖고 있다([ticket.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/core/tickets/models/ticket.ts)). 그런데 `movieId`와 `theaterId`는 `showtimeId`를 따라가면 알 수 있는 값이다. 이렇게 중복되는 데이터를 가져도 괜찮은 걸까?

SoLA에서 Core 서비스는 자기 컬렉션만 소유하고 다른 도메인의 컬렉션을 조인하지 않는다. `Ticket`에 `movieId`·`theaterId`가 없다면 티켓과 연결된 영화·극장을 알아내려고 매번 `ShowtimesService`를 다시 불러야 한다. 티켓 조회는 예매 흐름의 한복판에 있는 뜨거운 경로다.

한 서비스가 DB 전체를 조인할 수 있는 구조라면 강한 정규화가 일반적이다. 그러나 서비스가 자기 컬렉션만 소유하는 구조에서는 정규화보다 **서비스 간 결합 감소**를 우선한다. 대가는 분명하다. 중복된 값은 함께 갱신해야 한다. 이 부담보다 조회 단순성이 중요하다고 판단될 때만 중복을 선택한다. 여기서는 상영이 확정된 뒤 영화·극장 ID가 바뀔 일이 사실상 없으므로 갱신 부담이 거의 없다.

`seat`는 좌석 ID를 참조하지 않고 블록·행·번호로 구성된 좌석 위치를 값 객체로 저장한다. 흥미로운 점은 실물이 `Theater`의 `Seat`와 `Ticket`의 `SeatPosition`을 자료 구조가 같은데도 별개 모델로 둔 것이다([seat-position.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/core/tickets/models/seat-position.ts)의 머리 주석). 극장의 좌석은 등급·통로 여부 같은 속성이 늘어날 수 있는 도메인 모델이고, 티켓의 좌석은 좌표만 있으면 되는 값이다. 자료 구조가 같다는 이유만으로 모델을 공유하면 두 도메인이 그 모델을 통해 결합한다.

## 3. 규모가 계약을 바꾼다

엔티티가 정해졌으니 `상영시간 생성 요청`을 처리해 보자. 지난 시간의 설계는 요청을 받아 검증하고 생성한 뒤 `201 Created`를 반환하는 동기식이었다. 이 계약이 유지될 수 있는지 최우선 요구사항의 숫자를 대입해 보자.

하나의 영화를 4,000개 극장에 등록한다고 가정하면 생성해야 하는 데이터는 다음과 같다.

```txt
showtimes = 4,000 * 60(상영일) * 8(일일 상영 횟수) = 1,920,000 개
tickets = showtimes 수 * 500(좌석 수) = 960,000,000 개
```

영화 한 편을 등록할 때마다 9억 6천만 개의 티켓을 생성해야 한다. HTTP 요청 하나가 응답을 기다릴 수 있는 시간이 아니다. 그리고 작업이 길어지는 만큼 동시성 문제도 커진다. 관리자 두 명이 동시에 상영시간을 등록하면 충돌하는 상영시간이 생기고, 결국 좌석이 중복 예약된다. `좌석 중복 예약 방지`는 최우선 요구사항이다.

### 3.1. 1차 스케치 — 큐 기반 비동기 처리

가장 먼저 떠오르는 그림은 큐다.

{% plantuml %}
@startuml
participant Frontend as frontend
participant Gateway as gateway
participant "ShowtimeCreation\nService" as creation
Queue Queue as queue

frontend -> gateway: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
gateway -> creation: requestShowtimeCreation(createDto)
creation -> creation: sagaId
creation -> queue: enqueue { createDto, sagaId }
gateway <-- creation: sagaId
frontend <-- gateway: Accepted(202)
...
queue -> creation: dequeue { createDto, sagaId }
creation -> creation: validate(createDto)
creation -> creation: bulkCreateShowtimes(createDto, sagaId)
creation -> creation: bulkCreateTickets(showtimes, sagaId)
@enduml
{% endplantuml %}

요청을 받으면 작업을 큐에 넣고 추적용 식별자와 함께 `202 Accepted`를 즉시 반환한다. 워커가 큐에서 작업을 꺼내 검증하고 생성한다. 진행 상황은 SSE(Server-Sent Events)로 흘려보낸다. 작업 추적 식별자는 뒤에 나올 사가를 내다보고 `sagaId`라고 부르기로 한다.

이 골격 — 접수 즉시 202, 추적 식별자, SSE 상태 스트림 — 은 nest-seed에 그대로 살아있다. [showtime-creation.http-controller.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway/showtime-creation.http-controller.ts)를 열면 `@HttpCode(HttpStatus.ACCEPTED)`가 붙은 `POST showtimes`와 `@Sse('event-stream')`이 있다.

그러나 이 스케치를 구현으로 가져가려면 답해야 할 질문이 둘 있다. 중간에 실패하면 어떻게 되는가. 그리고 큐가 동시성까지 해결해 주는가.

### 3.2. 질문 하나 — 중간에 실패하면 이미 만든 것이 남는다

검증 → 상영시간 생성 → 티켓 생성은 다단계 작업이다. 상영시간 190만 개를 만들고 티켓을 만들던 중에 DB 연결이 끊기면 어떻게 되는가? 상영시간은 있는데 티켓이 없는 반쪽짜리 데이터가 남는다. 이 상영시간은 예매 화면에 노출되지만 팔 티켓이 없다.

한 DB 안에서라면 트랜잭션으로 묶고 실패 시 롤백하면 된다. 그러나 9억 6천만 건의 삽입을 하나의 트랜잭션으로 묶을 수는 없다. 여러 단계로 나눠 진행하되, **중간에 실패하면 앞 단계에서 만든 것을 보상(compensation)으로 되돌리는** 패턴이 필요하다. 이것이 사가(saga)다.

사가를 직접 구현하려면 각 단계의 진행 상태를 저장하고, 죽은 워커의 작업을 이어받고, 보상을 재시도하는 장치가 전부 필요하다. nest-seed는 이것을 Temporal 워크플로에 맡겼다. 실물 흐름은 이렇다.

1. `ShowtimeCreationService`가 입력을 1차 확인하고 `ShowtimeCreationOrchestratorService`에 넘긴다.
2. 조율자가 `sagaId`를 만들고 그 값을 `workflowId`로 삼아 Temporal 워크플로를 시작한다([showtime-creation-orchestrator.service.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/showtime-creation/internal/showtime-creation-orchestrator.service.ts)). 같은 ID로 두 번 시작하려는 요청은 `REJECT_DUPLICATE` 옵션이 막는다.
3. 워크플로가 검증·생성을 액티비티로 실행하고, 상태가 바뀔 때마다 이벤트를 발행한다([workflow.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/showtime-creation/worker/workflow.ts)).

클라이언트가 SSE로 받는 상태는 다섯 가지다.

{% plantuml %}
@startuml
[*] --> waiting : 워크플로 시작 성공
waiting --> processing : 워커가 실행 시작
processing --> succeeded : 검증 통과, 생성 완료
processing --> failed : 검증 충돌\n아무것도 만들지 않았다
processing --> error : 만들다 실패\n보상(생성물 삭제)까지 끝냈다
succeeded --> [*]
failed --> [*]
error --> [*]
@enduml
{% endplantuml %}

종결 상태가 둘이 아니라 셋인 점에 주의하자. `failed`와 `error`는 다르다.

- **failed** — 검증에서 충돌이 발견되어 아무것도 만들지 않고 끝났다. 충돌한 상영시간 목록이 이벤트에 담겨 오고, 관리자는 시간을 고쳐 다시 요청하면 된다.
- **error** — 만들다가 실패했고, 이미 만든 것을 **보상으로 지운 뒤** 끝났다.

여기서 불변식이 하나 나온다. **보상을 끝낸 뒤에만 `error`를 발행한다.** 실물 워크플로의 catch 블록이 이 순서를 지킨다.

```ts
} catch (error: unknown) {
    // 정리를 마친 뒤에 종료를 알린다 — error 이벤트를 받았다면 보상까지 끝난 상태다.
    // 보상이 재시도 끝에 실패하면 이벤트 없이 워크플로 실패로 남아 운영자에게 드러난다.
    await compensate(input.sagaId)
    await emitStatusChanged({
        message: extractRootMessage(error),
        sagaId: input.sagaId,
        status: 'error'
    })
}
```

순서가 반대면 어떻게 되는가? 클라이언트는 `error`를 받고 "실패했지만 정리는 됐겠지"라고 믿고 같은 시간대로 재요청하는데, 아직 지워지지 않은 반쪽짜리 상영시간과 충돌해서 `failed`를 받는다. 클라이언트에게 `error`는 "정리까지 끝났다"는 신호여야 한다.

보상이 가능하려면 "이 사가가 만든 것"을 찾을 수 있어야 한다. 그래서 2장에서 예고한 속성이 여기서 추가된다. `Showtime`과 `Ticket`은 `sagaId`를 저장하고, 보상은 `sagaId`로 두 컬렉션을 지운다. 실물 스키마에는 `sagaId` 인덱스까지 걸려 있고, 인덱스 주석이 용도를 밝힌다 — "showtime-creation 보상 처리에서 사가가 만든 상영을 한 번에 찾는 경로이다". 티켓 쪽에도 같은 주석이 있다.

{% plantuml %}
@startuml
class Showtime {
...
sagaId: string
}

class Ticket {
...
sagaId: string
}
Ticket "\*" --> "1" Showtime
@enduml
{% endplantuml %}

### 3.3. 질문 둘 — 큐가 동시성도 해결해 주는가

큐는 작업을 순차적으로 내보내니까 동시성 문제도 해결해 준다고 생각하기 쉽다. 이 문장에는 전제가 하나 숨어 있다. **소비자가 전역적으로 하나일 때만 참이다.**

분산 큐 자체는 죄가 없다. BullMQ 같은 Redis 기반 큐는 잡 하나가 두 워커에 동시에 배정되지 않는 것, 즉 **분배의 원자성**을 보장하고, 그 보장은 인스턴스가 몇 개든 유효하다. 그러나 지금 우리의 경쟁은 잡 하나의 문제가 아니라 **잡 둘 사이의 문제다.** 관리자 두 명이 겹치는 시간대를 제출하면 서로 다른 잡 두 개가 생긴다. 가용성과 처리량을 위해 워커를 여러 개 둔다면 — 실물은 API 컨테이너를 4개 배포하고 각 컨테이너가 워커를 겸한다 — 두 잡은 서로 다른 워커에서 병렬로 실행된다. 분배는 순차여도 실행은 겹친다. 각자 검증하는 시점에는 상대가 만들 상영시간이 아직 DB에 없으므로 둘 다 검증을 통과한다. 검증과 삽입 사이의 시간 차가 곧 경쟁 구간이다.

큐 차원에서 막는 방법이 없지는 않다. 전역 동시성을 1로 제한하면(BullMQ의 `setGlobalConcurrency(1)`, 혹은 워커를 하나만 두는 것) 큐 전체가 직렬화된다. 사실상 큐 모양의 분산 락이다. 그러니 정확한 명제는 이렇다. 큐가 기본으로 주는 것은 **부하 흡수와 분배의 원자성**이지 효과의 직렬화가 아니고, 직렬화가 필요하면 — 전역 동시성 1이든 락이든 — **명시적인 장치를 골라서 켜야 한다.**

우리는 사가 때문에 큐 대신 Temporal을 쓰기로 했으므로(3.2), 직렬화 장치도 큐 설정이 아니라 락이다. 실물은 검증+삽입을 분산 락으로 직렬화한다. [activities.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/showtime-creation/worker/activities.ts)의 주석이 정확히 이 이유를 설명한다.

```ts
// 검증과 삽입은 복제본 경계를 넘어 원자적으로 취급해야 한다.
// 두 워커가 같은 시간대의 사가를 동시에 검증하면, 아직 삽입되지 않은
// 서로의 결과를 보지 못해 둘 다 통과할 수 있다.
// 분산 락 안에서 검증과 삽입을 함께 실행해 같은 시간대는 한 사가씩 처리한다.
return this.cache.withLockBlocking<ValidateAndCreateResult>(
    VALIDATE_CREATE_LOCK_KEY,
    VALIDATE_CREATE_LOCK_TTL_MS,
    async () => {
        /* 검증 → 생성 */
    },
    { waitMs: VALIDATE_CREATE_LOCK_WAIT_MS }
)
```

보상도 같은 락을 기다린다. 타임아웃으로 버려진 검증+삽입이 아직 락 안에서 삽입 중일 수 있으므로, 같은 락으로 직렬화해야 좀비 실행과 경합해서 고아 행이 남는 일을 막을 수 있다.

한편 최우선 요구사항인 좌석 중복 예약 — 티켓 이중 판매 — 은 락이 아니라 **원자 조건부 전이**로 막는다. "이 티켓이 Available인가?"를 확인한 뒤 "Sold로 바꾼다"를 실행하면 확인과 쓰기 사이에 다른 결제가 끼어들 수 있다. 그래서 조건을 갱신 쿼리 자체에 넣는다. [tickets.repository.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/core/tickets/tickets.repository.ts)의 `transitStatusMany`다.

```ts
async transitStatusMany(ticketIds: string[], from: TicketStatus, to: TicketStatus) {
    // 검사와 쓰기 사이에 다른 결제가 끼어드는 경쟁을 트랜잭션 + 상태 조건으로 차단한다.
    // 하나라도 `from` 상태가 아니면 전체를 중단해,
    // 겹치는 티켓 묶음의 동시 결제에서도 같은 티켓이 두 번 팔리지 않는다.
    await this.withTransaction(async (session) => {
        const result = await this.model.updateMany(
            { _id: { $in: ids }, status: from },
            { $set: { status: to } },
            { session }
        )
        // matchedCount가 모자라면 전이 불가 — 전체 중단
    })
}
```

"Available인 것만 Sold로"라는 조건이 갱신과 한 문장이므로 그 사이에 끼어들 틈이 없다. 같은 문제라도 성격에 따라 도구가 다르다. 상영시간 충돌 검사는 "겹치는 구간이 있는가"라는 집합 수준의 질의라 조건부 갱신 한 문장으로 표현할 수 없어서 락으로 구간 전체를 직렬화하고, 티켓 전이는 행 단위 조건으로 표현되므로 락 없이 쿼리로 끝낸다.

### 3.4. 실물 접수 흐름

지금까지의 결정을 반영한 접수 흐름이다. 모든 참여자가 실물 클래스다.

{% plantuml %}
@startuml
participant Frontend as frontend
participant "ShowtimeCreationHttp\nController" as ctrl
participant "ShowtimeCreation\nService" as svc
participant "ShowtimeCreation\nOrchestratorService" as orch
participant Temporal as temporal
participant "ShowtimeCreation\nEvents" as events

frontend -> ctrl: POST /showtime-creation/showtimes
ctrl -> svc: requestShowtimeCreation(createDto)
svc -> svc: assertStartTimesDoNotOverlap(createDto)
svc -> orch: enqueueShowtimeCreationJob(createDto)
orch -> orch: sagaId 생성
orch -> temporal: workflow.start(showtimeCreationWorkflow,\nworkflowId=sagaId, REJECT_DUPLICATE)
orch -> events: emitStatusChanged(waiting)
svc <-- orch: sagaId
ctrl <-- svc: RequestShowtimeCreationResponse { sagaId }
frontend <-- ctrl: Accepted(202)

frontend ->> ctrl: SSE /showtime-creation/event-stream
ctrl <<- events: { status, sagaId, ... }
frontend <<- ctrl: { status, sagaId, ... }
@enduml
{% endplantuml %}

작은 순서 하나도 근거가 있다. `waiting` 이벤트는 워크플로 시작에 **성공한 뒤에** 발행한다. 순서가 반대면 시작 실패 시에도 SSE 구독자가 `waiting`을 받고, 그 뒤로 어떤 이벤트도 오지 않아 그 `sagaId`는 영원히 진행 중으로 보인다.

`assertStartTimesDoNotOverlap`은 요청 **안에서** 시작 시각끼리 겹치는 입력을 사가 시작 전에 400으로 거절한다. 기존 상영과의 충돌은 검증 액티비티의 몫이지만, 요청이 자기 자신과 모순인 것은 접수 단계에서 끊는 것이 맞다. 잘못된 입력에 사가를 하나 소모할 이유가 없다.

#### 네이밍

`requestShowtimeCreation` 함수는 `BulkCreateShowtimesDto`를 받는다. 함수명을 따라 `RequestShowtimeCreationDto`가 아닌 이유는 뭘까? 이 함수는 요청을 전달하는 역할만 하고, DTO가 기술하는 실제 작업은 상영시간 대량 생성이기 때문이다. DTO 이름은 함수가 아니라 데이터가 기술하는 동작을 따른다.

반면 응답은 `RequestShowtimeCreationResponse`라는 전용 타입이다. 조회 요청은 도메인 모델을 그대로 반환하면 되므로 응답 DTO를 따로 정의할 일이 드문데, 여기는 `sagaId`라는 이 요청에만 있는 응답이라 전용 타입이 필요하다. 모든 함수에 Request/Response 쌍을 기계적으로 만드는 프로젝트도 있지만, 실제로 필요한 경우는 생각보다 적다.

## 4. 충돌 검사 — 복잡도보다 입력 전제

검증의 핵심은 등록하려는 상영시간이 기존 상영시간과 겹치는지 검사하는 것이다. 알고리즘 후보가 둘 있다.

### 4.1. 후보 하나 — 슬롯 격자

먼저 떠오르는 방식은 시간을 10분 단위 슬롯으로 쪼개는 것이다. 생성하려는 상영시간을 10분 단위 timeslot의 Set으로 만들어 두고, 기존 상영시간도 `startTime`부터 `endTime`까지 10분 단위로 쪼개면서 각 슬롯이 Set에 있는지 확인한다. 예를 들어 09:30부터 30분짜리 상영은 `{0930, 0940, 0950}`이라는 키가 되고, 기존 상영 11:00~12:30은 `1100, 1110, ..., 1220`으로 쪼개져 하나씩 조회된다.

다른 후보는 시작과 끝을 직접 비교하는 구간 겹침 방식이다. 복잡도만 보면 승부가 난 것처럼 보인다. 슬롯 방식은 Set 조회가 상수 시간이니 O(M+N)이고, 구간 겹침은 이중 루프라 O(M×N)이다.

### 4.2. 반례 — 시작 분이 격자에서 어긋나면 충돌을 놓친다

그러나 복잡도보다 먼저 따질 것이 있다. 정확성이다.

기존 상영이 10:00~12:00이고, 새 상영이 10:05~11:05라고 하자. 두 상영은 55분이 겹친다. 그런데 슬롯 키를 만들어 보면 —

```txt
새 상영의 슬롯:   1005, 1015, 1025, 1035, 1045, 1055
기존 상영의 슬롯: 1000, 1010, 1020, ..., 1150
```

교집합이 없다. 시작 분이 10분 격자에서 5분 어긋났을 뿐인데 55분짜리 충돌이 통과된다. 좌석 중복 예약 방지가 최우선 요구사항인 시스템에서, 특정 입력에서만 조용히 뚫리는 검증은 최악의 결함이다. 시연에서는 정시 입력만 쓰니까 항상 통과하고, 운영에서 누군가 10:05를 입력하는 날 사고가 난다.

물론 시각을 격자에 맞춰 내림/올림해서 보정하면 막을 수는 있다. 그러나 그 보정 규칙이 또 하나의 검증 대상이 된다. 정확성을 지키기 위한 코드가 알고리즘 본체보다 미묘해지면 방향이 잘못된 것이다.

이 반례는 nest-seed에 회귀 테스트로 박제되어 있다([showtime-creation.spec.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/__tests__/integration/application/showtime-creation.spec.ts)).

```ts
it('시작 분이 10분 단위로 정렬되지 않은 새 상영도 겹치면 충돌로 보고한다', async () => {
    // 기존 10:00-12:00과 새 10:05-11:05는 55분이 겹친다.
    // 슬롯 격자로 비교하면 시작 분이 다를 때 키 교집합이 비어 충돌을 놓친다.
```

### 4.3. 실물의 선택 — 구간 겹침 비교

그래서 구간 겹침 비교를 채택한다. nest-seed의 실물이 이 결정이다 — [showtime-bulk-validator.service.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/showtime-creation/internal/showtime-bulk-validator.service.ts)의 첫머리다.

```ts
// 끝 시각은 포함하지 않는다.
// A가 12:00에 끝나면 12:00 시작하는 B와 곧바로 이어져도 충돌로 보지 않는다.
// 청소 시간 같은 간격이 필요하면 호출자가 입력 단계에서 그 간격을 설정해야 한다.
const overlaps = (a: DateTimeRange, b: ShowtimeDto) =>
    a.start.getTime() < b.endTime.getTime() && b.startTime.getTime() < a.end.getTime()
```

두 구간이 겹칠 조건은 "각자의 시작이 상대의 끝보다 앞"이라는 부등식 두 개가 전부다. 격자 정렬 같은 입력 전제가 없으므로 10:05든 10:07이든 똑같이 정확하다.

경계 정책도 이 한 줄에 들어 있다. 부등호가 `<`이므로 **끝 시각은 겹침에 포함하지 않는다**. 12:00에 끝나는 상영과 12:00에 시작하는 상영은 충돌이 아니다. 상영 사이에 청소 시간이 필요하다면 그것은 충돌 검사가 몰래 끼워 넣을 정책이 아니라 입력 단계에서 정할 운영 정책이다. 통합 테스트가 이 경계를 문서화한다. 기존 상영이 16:30에 시작할 때 16:00~16:30인 새 상영은 경계가 맞닿을 뿐 충돌이 아니라고 단언하는 케이스가 있다.

그러면 아까의 O(M×N)은 어떻게 되는가? 결론부터 말하면 이 문제에서는 걱정할 대상이 아니다.

- M(요청의 시작 시각 수)은 하루 8회차 수준으로 작고, 요청 안에서 서로 겹치는 시각은 3장의 `assertStartTimesDoNotOverlap`이 접수 단계에서 이미 거절했다.
- N(비교할 기존 상영 수)은 DB 조회 단계에서 이미 좁혀진다. 검증자는 극장별 기존 상영 전부가 아니라, 새 상영 범위와 겹칠 가능성이 있는 것만 조회한다. 이때 조회 하한을 기존 상영의 시작이 아니라 **끝 시각**에 걸어야 한다. 새 상영이 10:00~12:00일 때 09:00에 시작한 기존 상영은 시작만 보면 범위 밖이지만 11:00에 끝나면 충돌이기 때문이다(이것도 실물에 회귀 테스트가 있다).
- 이 규모에서 O(M×N)과 O(M+N)의 차이는 측정조차 어렵다. 진짜 비용은 비교 루프가 아니라 9억 6천만 건의 삽입과 DB 왕복이다.

성능을 이유로 정확성이 위태로운 알고리즘을 고르는 것은, 병목이 어디인지 재보기 전에 최적화부터 한 것이다. 교훈은 하나다. **알고리즘을 고를 때는 복잡도보다 입력 전제를 먼저 따져라.** 슬롯 격자의 O(M+N)은 "모든 시각이 격자 위에 있다"는 전제 위의 숫자였고, 그 전제는 요구사항 어디에도 없었다.

### 4.4. 실물 검증 흐름

검증 전체를 시퀀스로 정리하면 다음과 같다. 호출자는 3장에서 본 Temporal 액티비티다.

{% plantuml %}
@startuml
participant "ShowtimeCreation\nActivities" as activities
participant "ShowtimeBulkValidator\nService" as validator
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes

activities -> validator: validate(createDto)
validator -> movies: allExist([movieId])
validator -> theaters: allExist(theaterIds)
validator -> showtimes: search({ theaterIds,\nendTimeRange, startTimeRange })
validator -> validator: findConflictingShowtimes()
note right
기존 상영 중 생성하려는 상영과 구간이 겹치는 것을 찾는다.
(existing.startTime < new.endTime &&
new.startTime < existing.endTime)
같은 기존 상영이 여러 새 시각과 겹쳐도
결과에는 한 번만 넣는다.
end note
activities <-- validator: { isValid, conflictingShowtimes }
@enduml
{% endplantuml %}

충돌 목록은 그대로 `failed` 이벤트에 실려 관리자에게 돌아간다. 어떤 상영과 겹쳤는지 알아야 시간을 고칠 수 있기 때문이다. 유스케이스 명세서의 대안 흐름 — "어떤 상영시간이 겹쳤는지 정보를 보여준다" — 이 이벤트 페이로드로 착지한 것이다.

이름에 대한 메모 하나. `ShowtimeBulkValidatorService`는 하는 일이 단순한데 Service가 붙는다. 이 프로젝트에서는 다른 서비스를 호출해서 필요한 데이터를 스스로 구해오면 Service라고 명명한다. 만약 호출자가 기존 상영 목록까지 전부 넘겨주고 비교만 하는 역할이었다면 Service 없이 `ShowtimeBulkValidator`라고 했을 것이다. 실물 검증자는 영화·극장·상영을 직접 조회하므로 Service가 맞다.

## 5. 그런데 말입니다 — Creator가 티켓까지 만들어도 되는가

검증을 통과하면 생성이다. 실물의 생성자는 [showtime-bulk-creator.service.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/showtime-creation/internal/showtime-bulk-creator.service.ts) 하나이고, 상영시간과 티켓을 **모두** 만든다.

{% plantuml %}
@startuml
participant "ShowtimeCreation\nActivities" as activities
participant "ShowtimeBulkCreator\nService" as creator
participant "Showtimes\nService" as showtimes
participant "Theaters\nService" as theaters
participant "Tickets\nService" as tickets

activities -> creator: create(createDto, sagaId)
activate creator
creator -> creator: bulkCreateShowtimes(createDto, sagaId)
creator -> showtimes: createMany(createDtos)
creator -> showtimes: search({ sagaIds: [sagaId] })
creator <-- showtimes: showtimes

    creator -> creator: bulkCreateTickets(showtimes, sagaId)
    creator -> theaters: getMany(theaterIds)
    creator <-- theaters: theaters
    loop showtime in showtimes
        creator -> creator: Seatmap.getAllSeats(theater.seatmap)
        creator -> tickets: createMany(createTicketDtos)
    end

deactivate creator
activities <-- creator: { createdShowtimeCount, createdTicketCount }
@enduml
{% endplantuml %}

극장 좌석 배치를 조회해서 좌석 하나당 티켓 하나를 만드는 구조다. 그런데 여기서 의문이 들 수 있다. 상영시간 생성자가 티켓까지 생성하는 것은 서비스 수준의 단일 책임 원칙 위반이 아닌가? `TicketBulkCreatorService`로 쪼개야 하지 않나?

### 5.1. 개념이 강결합이면 코드도 함께 둔다

상영시간과 티켓의 관계를 유스케이스로 돌아가서 보자.

{% plantuml %}
@startuml
left to right direction
rectangle PaymentGateway
actor customer
actor administrator

package "Movie Booking System" as mbs {
package tickets {
usecase "티켓 생성하기" as GenerateTickets #yellow
usecase "티켓 구매하기" as PurchaseTickets
}

    package showtimes {
        usecase "상영시간 생성하기" as CreateShowtimes #yellow
    }

    package theaters {
    }

    package movies {
    }

}

administrator --> CreateShowtimes
CreateShowtimes ..> GenerateTickets
customer --> PurchaseTickets
PurchaseTickets ..> PaymentGateway
@enduml
{% endplantuml %}

상영시간이 존재하면 티켓이 존재해야 하고, 티켓이 존재한다는 것은 상영시간이 존재한다는 뜻이다. 유스케이스 명세서의 사후 조건도 두 줄이 한 묶음이었다 — "상영시간이 등록되어야 한다. 상영시간에 해당하는 티켓이 생성되어야 한다." 이렇게 개념적으로 강하게 결합된 도메인은 설계와 구현에도 그대로 반영하는 것이 최우선 원칙이다([본질 기반 해석(EBI)]({% post_url 2024-05-04-ebi %})이란 얘기다). OOP 원칙과 아키텍처 패턴은 그 다음 고려사항이다.

그래서 "티켓 없는 상영시간"이라는 중간 상태를 만들 수 있는 구조 — 상영시간 생성과 티켓 생성이 서로를 모르는 구조 — 는 도메인을 배반한다. 이 관점에서 Creator의 책임을 다시 읽으면, "상영시간을 만든다"와 "티켓을 만든다"라는 두 책임이 아니라 **"판매 가능한 상영 회차를 연다"**라는 한 책임이다. 티켓 없는 상영 회차는 판매할 수 없으므로 미완성이다.

그럼에도 개발자 본능을 거스를 수 없다면 `ShowtimeBulkCreatorService`와 `TicketBulkCreatorService`로 나누고 워크플로가 둘을 순서대로 호출하게 리팩토링할 수는 있다. 두 생성자가 같은 사가 안에서 동기적으로 묶여 있는 한 본질 기반 해석을 위반한 것도 아니다. 다만 그 리팩토링이 지금 소모할 가치가 있는 작업 시간인지는 프로젝트마다 판단할 일이고, 경험상 시간은 항상 부족했다. nest-seed도 나누지 않았다.

### 5.2. 이벤트로 찢는 것은 다른 문제다

그리고 시간이 허락해도 리팩토링은 거기까지만 해야 한다. 한 걸음 더 나가서 "상영시간 생성 완료 이벤트를 발행하면 티켓 생성자가 구독해서 만든다"는 이벤트 기반 분리를 떠올릴 수 있는데, 이것은 결이 다른 결정이다.

이벤트 기반 통신의 명분은 장애 전파 차단이다. 호출받는 쪽이 죽어도 호출하는 쪽은 멈추지 않는다는 것이다. 그러나 상영시간 생성과 티켓 생성처럼 사실상 하나의 유스케이스라면, 한쪽이 실패했을 때 다른 쪽만 성공하는 것은 "장애가 전파되지 않은 상태"가 아니라 **미완성 데이터**다. 어차피 함께 성공하거나 함께 취소되어야 한다.

억지로 분리하면 이득 없이 복잡도만 는다. 호출 구조를 비교해 보자.

{% plantuml %}
@startuml
skinparam componentStyle rectangle

title 가장 간단한 동기식 호출

package "Service B" as SB {
component "onCommandEvent()" as B_cons
}

package "Service A" as A {
component "sendCommand()" as A_send
}

A_send --> B_cons : (1) Request
A_send <.. B_cons : (2) Response
@enduml
{% endplantuml %}

동기식은 이렇게 부르고 결과를 받으면 끝이다. 장애 전파를 막겠다고 비동기 이벤트를 끼워 넣으면 가장 간단한 호출이 이렇게 된다.

{% plantuml %}
@startuml
skinparam componentStyle rectangle

title 가장 간단한 비동기 이벤트 호출

package "Service B" as SB {
component "onCommandEvent()" as B_cons
}

package "Service A" as A {
component "sendCommand()" as A_send
component "onResponseEvent()" as A_resp
database "State DB" as A_db
}

A_send --> A_db : (1) PENDING
A_send --> B_cons : (2) Request
B_cons --> A_resp : (3) Response
A_resp --> A_db : (4) DONE/FAIL
@enduml
{% endplantuml %}

응답을 받을 핸들러가 따로 생기고, 요청과 응답 사이의 진행 상태를 보관할 저장소가 생긴다. 코드로 치면 이 차이다.

```ts
const { readFileSync, readFile } = require('fs')

// 동기: 결과를 받아서 바로 다음 작업을 하면 된다.
const syncText = readFileSync('./example.txt')

// 비동기: 호출이 끝나도 결과가 없다.
let asyncText = ''
readFile('./example.txt', 'utf8', (err, text) => {
    asyncText = text
})
// asyncText에 값이 없는데 다음 작업을 어쩌지??
```

nest-seed의 실물이 이 논증의 증거이기도 하다. 3장에서 본 보상 액티비티는 `sagaId` 하나로 티켓과 상영시간을 **한곳에서** 지운다. 생성이 한 Creator에 있으니 되돌리기도 한 곳이다. 만약 티켓 생성이 이벤트 구독자로 찢어져 있었다면 보상도 찢어진다 — 상영시간 쪽 사가는 티켓이 어디까지 만들어졌는지 모르므로, 티켓 쪽의 진행 상태를 조회하거나 보상 이벤트를 또 발행해야 한다. 강결합 유스케이스를 이벤트로 분리하면 정상 경로보다 실패 경로가 먼저 복잡해진다.

물론 비동기 이벤트가 틀린 도구라는 얘기가 아니다. nest-seed에도 NATS pub/sub이 있다. 다만 그 용도는 사가 상태를 컨테이너 경계 너머의 SSE 클라이언트에게 broadcast하는 것 — 결과를 기다리는 사람이 없는 단방향 알림 — 이지, 하나의 유스케이스를 두 토막 내는 것이 아니다. 경계는 도메인의 결합도가 정한다.

## 6. 전체 그림

지금까지의 결정을 한 장에 모으면 다음과 같다. 4개 컨테이너, Temporal, NATS가 모두 등장하는 실물 사가 시퀀스다.

{% plantuml %}
@startuml
actor Client
participant "API 컨테이너" as API
participant Temporal
participant "액티비티(워커)" as Worker
queue NATS

Client -> API: POST /showtime-creation/showtimes
API -> Temporal: workflow.start(workflowId=sagaId,\nREJECT_DUPLICATE)
API -> NATS: waiting 발행 — 시작 성공 후에만
API --> Client: 202 { sagaId }
note right of Client
이후 모든 이벤트는 NATS → 각 API 컨테이너
→ SSE(event-stream)로 클라이언트에 전달된다
end note

Temporal -> Worker: showtimeCreationWorkflow 실행
Worker -> NATS: processing
Worker -> Worker: validateAndCreate\n(분산 락 안에서 검증+삽입, 자동 재시도 없음)
alt 성공
Worker -> NATS: succeeded(생성 수)
else 시간대 충돌
Worker -> NATS: failed(충돌 상영 목록)
else 예외
Worker -> Worker: compensate(sagaId 행 삭제,\n같은 분산 락으로 직렬화)
Worker -> NATS: error — 보상을 끝낸 뒤에만
end
@enduml
{% endplantuml %}

상태 이벤트가 NATS를 거치는 이유도 컨테이너가 여럿이기 때문이다. 워크플로를 실행하는 워커와 SSE 연결을 쥐고 있는 컨트롤러가 서로 다른 컨테이너에 있을 수 있다. 그래서 워커는 상태를 NATS로 발행하고, 각 컨테이너의 [ShowtimeCreationEvents](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/showtime-creation/showtime-creation.events.ts)가 받아서 자기에게 붙은 SSE 클라이언트에게 흘려보낸다.

`validateAndCreate`에 자동 재시도가 없다는 것도 눈여겨보자. 검증 후 생성하는 작업은 중간에 실패한 뒤 통째로 다시 실행하면 중복 생성될 수 있어서 재시도를 끈다. 반면 보상은 멱등(같은 삭제를 두 번 실행해도 결과가 같다)이라 재시도를 켠다. 상태 알림도 같은 이유로 재시도한다. 단계마다 재시도 정책이 다른 것이 아니라, 단계마다 멱등성이 달라서 재시도 정책이 따라간 것이다.

마지막으로 모듈 구조를 클래스 수준에서 요약한다. 3.1의 스케치에 있던 큐는 최종 구조에 없다. 그 자리를 조율자와 Temporal 워크플로가 대신한다.

{% plantuml %}
@startuml
package "showtime-creation — 공개" {
class ShowtimeCreationService {
requestShowtimeCreation(createDto)
searchMoviesPage(searchDto)
searchTheatersPage(searchDto)
searchShowtimes(theaterIds)
}
class ShowtimeCreationEvents {
emitStatusChanged(event)
observeStatusChanged()
}
}

package "internal/" {
class ShowtimeCreationOrchestratorService {
enqueueShowtimeCreationJob(createDto)
}
class ShowtimeBulkValidatorService {
validate(createDto)
}
class ShowtimeBulkCreatorService {
create(createDto, sagaId)
}
}

package "worker/" {
class showtimeCreationWorkflow <<Temporal>> {
}
class ShowtimeCreationActivities {
validateAndCreate(input)
compensate(sagaId)
emitStatusChanged(event)
}
}

ShowtimeCreationService --> ShowtimeCreationOrchestratorService
ShowtimeCreationOrchestratorService ..> showtimeCreationWorkflow : workflow.start
ShowtimeCreationOrchestratorService --> ShowtimeCreationEvents : waiting
showtimeCreationWorkflow ..> ShowtimeCreationActivities : proxyActivities
ShowtimeCreationActivities --> ShowtimeBulkValidatorService
ShowtimeCreationActivities --> ShowtimeBulkCreatorService
ShowtimeCreationActivities --> ShowtimeCreationEvents : processing, succeeded,\nfailed, error
@enduml
{% endplantuml %}

스케치에서 워커가 하던 일 — 작업 접수, 순차 실행, 상태 발행 — 은 세 곳으로 흩어졌다. 접수와 시작은 조율자가, 실행 순서와 실패 처리는 워크플로가, 실제 부수효과는 액티비티가 맡는다. 큐 관리 코드는 한 줄도 없다. 작업의 저장과 분배, 죽은 워커의 작업 인수는 Temporal이 하는 일이기 때문이다.

## 7. 결론

이번 시간에는 상영시간 생성의 설계를 실물까지 끌고 왔다. 정리하면 이렇다.

- 순환 참조는 SoLA의 규칙 두 개로 구조에서 막았다. Application은 조립할 게 있을 때만 만들고(실물 4개), 컨트롤러는 Gateway로 모으고, 모듈 내부는 internal/로 감췄다.
- 좌석은 관리 대상이 아니라서 ID가 없고, 티켓은 결합 감소를 위해 movieId·theaterId를 중복 보유한다.
- 9억 6천만이라는 숫자가 201을 202 + sagaId + SSE로 바꿨고, 다단계 작업의 중간 실패가 사가(Temporal)를 불렀다. failed는 아무것도 만들지 않은 종결, error는 보상까지 끝낸 종결이며, 보상을 끝낸 뒤에만 error를 발행한다.
- 큐가 기본으로 주는 것은 분배의 원자성이지 효과의 직렬화가 아니다. 검증+삽입은 분산 락으로 직렬화하고, 티켓 이중 판매는 원자 조건부 전이로 막는다.
- 충돌 검사는 슬롯 격자를 버리고 구간 겹침 비교를 채택했다. 격자는 시작 분이 어긋나면 충돌을 놓치고, 그 반례는 회귀 테스트로 박제됐다.
- 상영시간과 티켓은 개념적 강결합이므로 Creator 하나가 둘 다 만든다. 강결합 유스케이스를 이벤트로 찢으면 실패 경로부터 복잡해진다.

이번 편의 갈림길 둘을 관통하는 것은 하나다. 문서 위에서는 큐의 순차 처리가 동시성을 해결해 주는 것처럼 보이고, 슬롯 격자가 더 빨라 보인다. 그러나 컨테이너 4개를 실제로 띄우고 10:05라는 입력을 실제로 넣어보면 다르게 판정된다. 설계의 심판은 문서가 아니라 실행이다. 이 연재가 결정마다 실물을 여는 이유가 그것이다.

다음 시간에는 그 실행 얘기를 한다. 이 설계를 어떤 순서로 구현하고, 202와 SSE와 보상 같은 계약을 테스트가 어떻게 지키는지 다룬다.

---

이전 글: [백엔드 서비스 분석과 설계 — nest-seed로 증명하기 (2)]({% post_url 2026-07-03-nest-seed-design-2 %})
