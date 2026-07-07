---
layout: post
title: 백엔드 서비스 분석과 설계 — nest-seed로 증명하기 (2)
lang: ko
---

우리는 지난 시간에 `Movie Booking System`의 유스케이스 다이어그램을 그렸다. 소프트웨어 분석/설계 과정에서 유스케이스 다이어그램을 그렸다면, 이는 성공적인 출발이라 할 수 있다.

이번 시간에는 여러 유스케이스 중에서 절차가 복잡해 보이는 두 유스케이스인 `상영시간 생성하기`와 `티켓 구매하기` 중 `상영시간 생성하기`를 먼저 분석해 보도록 하겠다. `티켓 구매하기`를 별도 편으로 다루지는 않지만, 그 핵심 문제 — 외부 결제에 걸친 작업이 중간에 실패하면 되돌려야 한다는 것 — 는 상영시간 생성과 같은 무늬라서 다음 글의 사가와 보상 이야기에 함께 등장한다.

그리고 이번 글부터는 설계의 끝에서 실물을 대조한다. 여기서 그리는 REST API가 [nest-seed](https://github.com/mannercode/nest-seed) 저장소에 어떤 코드로 착지했는지 파일을 열어서 확인할 것이다.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle PaymentGateway

package "Movie Booking System" as mbs {
package tickets {
usecase "티켓 구매하기" as PurchaseTickets #yellow
usecase "티켓 생성하기" as GenerateTickets
}

    package showtimes {
        usecase "상영시간 생성하기" as CreateShowtimes #yellow
    }

    package theaters {
    }

    package movies {
    }

    package customers {
    }

}

administrator --> CreateShowtimes
customer -> PurchaseTickets
PurchaseTickets ..> PaymentGateway
CreateShowtimes ..> GenerateTickets
@enduml
{% endplantuml %}

## 1. 어떤 유스케이스를 먼저 분석할까?

`상영시간 생성하기`와 `티켓 구매하기` 중 어떤 것을 먼저 분석하는 것이 좋을까? 나는 보통 데이터를 **생성하는** 유스케이스부터 시작하는 편이다. 조회 기능은 데이터가 먼저 있어야 의미가 있기 때문이다.

여기서는 티켓을 생성해야 티켓을 구매할 수 있기 때문에 `상영시간 생성하기` 유스케이스를 먼저 분석해 본다.

## 2. `상영시간 생성하기` 유스케이스 명세서

우리는 도메인 전문가에게 상영시간을 생성하려면 어떤 절차가 필요한지 물어본 뒤, 아래와 같이 정리한다.

**목표**: 영화의 상영시간 생성하기

**액터**: Admin (이하 administrator를 Admin으로 줄여 쓴다)

**선행 조건**:

- 관리자는 시스템에 로그인해야 합니다.
- 영화와 극장은 시스템에 등록되어 있어야 합니다.

**트리거**:

- 관리자가 영화 상영시간 생성 페이지를 방문합니다.

**기본 흐름**:

1. 시스템은 현재 등록된 영화 목록을 보여줍니다.
2. 관리자는 상영시간을 등록하려는 영화를 선택합니다.
3. 시스템은 현재 등록된 극장 목록을 보여줍니다.
4. 관리자는 상영시간을 등록하려는 극장들을 선택합니다.
5. 시스템은 등록된 상영시간 목록을 보여줍니다.
6. 관리자는 각 극장에 대한 상영시간을 입력합니다.
7. 관리자는 상영시간을 등록합니다.
8. 시스템은 등록한 상영시간이 기존의 상영시간과 겹치는지 검사합니다.
9. 시스템은 상영시간을 등록하고, 상영시간 생성이 완료되었다는 메시지를 보여줍니다.

**대안 흐름**:

- 만약 상영시간이 기존의 상영시간과 겹친다면
    1. 시스템은 상영시간 생성에 실패했다는 메시지와 함께 어떤 상영시간이 겹쳤는지 정보를 보여줍니다.
    2. 기본 흐름 5단계로 돌아갑니다.

**사후 조건**:

- 영화의 상영시간이 성공적으로 등록되어야 합니다.
- 상영시간에 해당하는 티켓이 생성되어야 합니다.

CreateShowtimes의 시작 조건인 `트리거`를 정의하고, 그에 따른 `기본 흐름`을 정리했다. 그 외에 `대안 흐름`과 `사후 조건` 등을 보면 `Movie Booking System`에서 무슨 일을 해야 할지 가늠할 수 있다.

명세서의 문장 하나하나가 그냥 문장으로 끝나지 않는다는 것을 미리 얘기해 두고 싶다. 예를 들어 선행 조건의 "관리자는 시스템에 로그인해야 합니다"라는 한 줄은 나중에 코드 한 줄로 착지한다. 이 글의 끝에서 확인한다.

## 3. `상영시간 생성하기` 시퀀스 다이어그램

유스케이스 명세서를 좀 더 읽기 쉽게 시퀀스 다이어그램으로 그려보자.

{% plantuml %}
@startuml
actor Admin
participant "Movie Booking System" as mbs

Admin -> mbs: 상영시간 생성 페이지를 방문
Admin <-- mbs: 영화 목록 제공

Admin -> mbs: 영화 선택
Admin <-- mbs: 극장 목록 제공

Admin -> mbs: 극장 선택
Admin <-- mbs: 상영시간 목록 제공

Admin -> Admin: 상영시간 선택
Admin -> mbs: 상영시간 생성 요청

mbs -> mbs: 상영시간 검증 성공

Admin <-- mbs: 상영시간 생성 성공 화면

@enduml
{% endplantuml %}

이 시퀀스 다이어그램은 `액터`, `트리거`, `기본 흐름`에 대한 내용을 담고 있고 `대안 흐름`은 빠져있다.

### 3.1. alt 연산자로 대안 흐름 표현

`대안 흐름`을 시퀀스 다이어그램으로 그려보자. `대안 흐름(Alternative Flow)`이니까 alt 연산자를 사용하는 것이 적절해 보인다.

{% plantuml %}
@startuml
actor Admin
participant "Movie Booking System" as mbs

Admin -> mbs: 상영시간 생성 페이지를 방문
Admin <-- mbs: 영화 목록 제공

Admin -> mbs: 영화 선택
Admin <-- mbs: 극장 목록 제공

Admin -> mbs: 극장 선택
Admin <-- mbs: 상영시간 목록 제공

Admin -> Admin: 상영시간 선택
Admin -> mbs: 상영시간 생성 요청

alt 충돌 없음
mbs -> mbs: 상영시간 검증 성공
Admin <-- mbs: 상영시간 생성 성공 화면
else 상영시간 충돌 발생
mbs -> mbs: 상영시간 검증 실패

    Admin <-- mbs: 상영시간 생성 실패 및 겹치는 상영시간 정보 표시
    Admin <-- mbs: 상영시간 목록 제공 (기본 흐름 5단계로 이동)

end

@enduml
{% endplantuml %}

alt 연산자를 사용한 대안 흐름의 표현이 나쁘지 않지만, `상영시간 목록 제공 (기본 흐름 5단계로 이동)` 이 부분은 표현이 직관적이지 않은 것 같다.

### 3.2. loop 연산자로 재시도 흐름 표현

`기본 흐름 5단계로 이동`하라는 것은 상영시간 입력을 반복하라는 뜻이다. 따라서 loop 연산자가 적절해 보인다.

{% plantuml %}
@startuml
actor Admin
participant "Movie Booking System" as mbs

Admin -> mbs: 상영시간 생성 페이지를 방문
Admin <-- mbs: 영화 목록 제공

Admin -> mbs: 영화 선택
Admin <-- mbs: 극장 목록 제공

Admin -> mbs: 극장 선택

loop 상영시간 충돌 시 재시도
Admin <-- mbs: 상영시간 목록 제공

    Admin -> Admin:  상영시간 선택
    Admin -> mbs:  상영시간 생성 요청

    alt 충돌 없음
        mbs -> mbs:  상영시간 검증 성공
        Admin <-- mbs: 상영시간 생성 성공 화면
    else 상영시간 충돌 발생
        mbs -> mbs:  상영시간 검증 실패

        Admin <-- mbs: 상영시간 생성 실패 및 겹치는 상영시간 정보 표시
    end

end
@enduml
{% endplantuml %}

loop 연산자를 사용해서 대안 흐름을 개선할 수 있었다. 그러나 프레임이 중첩되니 분석 단계의 문서임에도 불구하고 복잡해 보인다.

### 3.3. 대안 흐름만 표현

앞서 본 것처럼 프레임이 중첩되면 복잡해 보인다. 무엇이 옳은지는 프로젝트마다 다르지만 여기서는 `대안 흐름`을 분리하는 것이 좋아 보인다.

{% plantuml %}
@startuml
actor Admin
participant "Movie Booking System" as mbs

Admin -> mbs: 상영시간 생성 페이지를 방문
Admin <-- mbs: 영화 목록 제공

Admin -> mbs: 영화 선택
Admin <-- mbs: 극장 목록 제공

Admin -> mbs: 극장 선택

loop 상영시간 충돌 시 재시도
Admin <-- mbs: 상영시간 목록 제공

    Admin -> Admin:  상영시간 선택
    Admin -> mbs:  상영시간 생성 요청

    mbs -> mbs:  상영시간 검증 실패

    Admin <-- mbs: 상영시간 생성 실패 및 겹치는 상영시간 정보 표시

end
@enduml
{% endplantuml %}

UML에 익숙하지 않으면 다양한 연산자를 사용해서 화려하게 문서를 작성하고 싶은 욕구가 있을 수 있다.
그러나 설계는 구현과는 다르다. 요구사항을 보고 구현하듯이 설계 문서를 작성할 필요는 없다.

### 3.4. 대안 흐름을 시퀀스 다이어그램으로 그려야 할까?

설계는 구현을 하기에 충분한 정도의 정보를 담고 있으면 된다. 여기서 **충분하다**는 표현은 다소 모호할 수 있는데, 이는 팀의 상황에 따라 달라진다. 개발자의 실력이 높다면 설계를 간단하게 해도 충분할 것이다. 설계자와 구현자가 멀리 떨어져 있어서 긴밀한 커뮤니케이션이 어렵다면 설계를 좀 더 꼼꼼하게 해야 할 것이다.

여기서는 `대안 흐름`의 내용이 간단함에도 불구하고 설명을 위해 `대안 흐름`을 시퀀스 다이어그램으로 그려봤다. 그러나 실제 프로젝트라면 굳이 시퀀스 다이어그램으로 그리지 않았을 것이다.

## 4. REST API 설계

만약 화면 기획자나 디자이너라면 `상영시간 생성하기` 시퀀스 다이어그램을 더 확장할 필요는 없을 것이다. 그러나 우리는 백엔드를 대상으로 하고 있으니까 시퀀스 다이어그램을 확장해서 REST API 설계를 해보자.

### 4.1. Shallow Routing

{% plantuml %}
@startuml
actor Admin

Admin -> Frontend: 상영시간 생성 페이지를 방문
Frontend -> Backend:영화 목록 요청\nGET /movies?orderby=releaseDate:desc
Frontend <-- Backend: movies[]
Admin <-- Frontend: 영화 목록 제공

Admin -> Frontend: 영화 선택
Frontend -> Backend:극장 목록 요청\nGET /theaters?orderby=name:asc
Frontend <-- Backend: theaters[]
Admin <-- Frontend: 극장 목록 제공

Admin -> Frontend: 극장 선택
Frontend -> Backend: 상영시간 목록 요청\nGET /showtimes?theaterIds=[]
Frontend <-- Backend: showtimes[]
Admin <-- Frontend: 상영시간 목록 제공

Admin -> Admin: 상영시간 선택

Admin -> Frontend: 상영시간 생성 요청
Frontend -> Backend: 상영시간 생성 요청\nPOST /showtimes
note right
CreateShowtimesDto {
movieId,
theaterIds,
startTimes,
durationInMinutes
}
end note
Frontend <-- Backend: Created(201)
Admin <-- Frontend: 상영시간 생성 성공 화면
@enduml
{% endplantuml %}

이것은 경로를 짧게 가져가는 전형적인 Shallow Routing 설계로, URI를 짧고 평탄하게 유지해 주면서 서비스 진화·운용 부담을 덜어 주는 실용적 선택이다.

상영시간의 길이는 `durationInMinutes`로 받기로 했다. 초 단위로 받을 수도 있겠지만 상영시간을 초 단위로 입력하는 관리자는 없다. 입력하는 사람의 단위를 그대로 쓰는 것이 자연스럽다.

### 4.2. Namespace 추가

Shallow Routing 방식은 몇 가지 단점이 있다. 현재는 프로젝트 초기 단계이기 때문에 요청이 간단하지만 프로젝트가 진행되고 요구사항이 구체화될수록 API가 빈번히 변경될 수 있다. 예를 들면 이렇게 말이다.

```sh
GET /movies?orderby=releaseDate:desc&includes=showtime-summary
GET /theaters?orderby=name:asc&includes=showtime-count
```

API의 조건이 복잡해질수록 이것을 처리해야 하는 백엔드의 구현 부담이 증가한다. API를 사용하는 프론트엔드도 API 스펙을 파악하고 구현해야 하는 부담이 생긴다.

소프트웨어 개발은 요구사항이 계속 변경되기 때문에 유연성을 중시한다. 그러나 API에서 유연성을 제공한다는 것은 그만큼 사용과 구현이 어려워진다는 뜻이다.

불특정 다수를 대상으로 하는 서비스라면 유연성을 높여서 구체적인 구현을 사용자(여기서는 프론트엔드)에게 맡기는 것이 옳은 선택일 것이다. 그러나 지금은 `상영시간 생성`이라는 명확한 목적을 가진 요청이라는 것을 알고 있는 상황이다. 그렇다면 API도 이 상황을 잘 나타낼 수 있게 정의하는 것이 합리적일 것이다.

```sh
GET /showtime-creation/movies
GET /showtime-creation/theaters
```

이렇게 정의하면 이제 `상영시간 생성`의 요구사항이 크게 변경되지 않는 한 API를 변경할 필요는 없을 것이다.

이런 방식을 누군가는 컨텍스트 컨트롤러 패턴이라고 부르는 것 같기는 한데 표준으로 정해진 이름은 없는 것 같다. 이런 방식에 패턴이라는 이름까지 붙여야 하나 싶은 생각이 있어서 여기서는 `/showtime-creation`을 그냥 `네임스페이스`라고 정의한다.

주의할 점은 모든 유스케이스가 네임스페이스를 갖는 것은 아니라는 점이다. 네임스페이스는 그 단계들이 해당 유스케이스 안에서만 의미가 있을 때 쓴다. `GET /movies/:movieId`처럼 다른 맥락에서도 단독으로 의미가 있는 API는 네임스페이스 없이 리소스 경로 그대로 둔다. nest-seed는 이 기준을 [docs/apps.md](https://github.com/mannercode/nest-seed/blob/main/docs/apps.md)의 REST API 설계 절에 규칙으로 정리해 두었다.

### 4.3. Bottom-Up vs Top-Down

설계 없이 구현을 우선하는 경우 사고 과정은 대략 다음과 같다.

{% plantuml %}
@startuml
title Bottom-Up 사고 흐름 예시
|개발자|
start
:도메인 식별(영화·극장·티켓);
fork
:티켓 기능 CRUD 구현;
fork again
:극장 기능 CRUD 구현;
fork again
:영화 기능 CRUD 구현;
end fork
:상영시간 생성 요구 등장;
if (기존 API로 가능?) then (Yes)
:프런트에 기존 API 전달;
else (No)
:API 수정·확장 후 전달;
endif
:API 문서 업데이트;
stop
@enduml
{% endplantuml %}

Bottom-Up(데이터·구현 우선) 접근은 **현재 파악 가능한 테이블 중심으로 DDL을 먼저 정의**하고, 그 스키마를 그대로 노출하는 CRUD API를 작성한다. 이후 새로운 기능 요구가 생기면 기존 구현 범위 안에서 해결책을 찾으려 하기 때문에, **'상영시간 생성'**과 같은 상위 개념이 여러 API로 흩어져 응집도가 약해질 수 있다.

반대로 Top-Down(개념 우선) 접근은 **'상영시간 생성'이라는 유스케이스(도메인 개념)를 기점으로** 필요한 단계를 정의하고, 그 흐름에 맞춰 엔드포인트 경로를 설계한다. 그래서 자연스럽게 `/showtime-creation`과 같은 네임스페이스를 떠올릴 수 있다.

두 방법 모두 장단이 있으나, [본질 기반 해석(EBI)]({% post_url 2024-05-04-ebi %}) 관점에서는 **Top-Down**이 도메인 개념과 API 구조를 일관되게 유지하기 쉽다.

### 4.4. 긴 쿼리 파라미터의 API

지난 시간에 정의한 최우선 요구사항을 확인해 보면 다음과 같다.

```txt
최우선 요구사항

1. 극장은 최소 4,000개 이상
2. 좌석 중복 예약 방지 필수
3. 기존 데이터 마이그레이션 필수
```

극장이 4,000개 이상이라고 되어있는데 이것은 theaterIds를 입력받는 모든 API에서 문제가 될 수 있다.

```sh
GET /showtime-creation/showtimes?theaterIds=[]
```

숫자를 대입해 보자. 극장 ID가 MongoDB의 ObjectId라면 하나에 24자다. 구분자까지 포함해 4,000개면 대략 10만 자, 100KB짜리 쿼리 스트링이 된다. HTTP 표준은 URL 길이를 제한하지 않지만 현실의 서버·프록시·브라우저는 대부분 요청 라인 버퍼가 수 KB 수준이다. 극장을 수십 개만 선택해도 위험 구간에 들어가고, 전체 선택은 시작조차 못 한다.

이렇게 긴 쿼리 파라미터가 예상되는 API는 POST 방식으로 정의하기로 한다.

```sh
POST /showtime-creation/showtimes/search
{
    theaterIds:[]
}
```

조회인데 POST를 쓰는 것이 REST 원칙에 어긋난다고 느낄 수 있다. 그러나 요구사항의 숫자가 GET을 허용하지 않는다. 원칙과 요구사항이 부딪히면 요구사항이 이긴다. 대신 경로 끝에 `/search`를 붙여서 생성이 아니라 검색이라는 것을 드러낸다.

여기서 눈여겨볼 것은 "극장 4,000개"라는 요구사항 문서의 숫자 하나가 API의 형태를 바꿨다는 사실이다. 최우선 요구사항을 문서 첫머리에 정리해 두는 이유가 이것이다. 설계 선택의 순간마다 돌아와서 대조할 기준이 된다. 그리고 이 숫자는 아직 일을 다 끝내지 않았다. 다음 글에서 한 번 더 설계를 바꾼다.

### 4.5. 최종 REST API 설계 (CreateShowtimes)

지금까지 설명한 설계 지침을 반영해서 시퀀스 다이어그램을 다시 그려보자.

{% plantuml %}
@startuml
actor Admin
Admin -> Frontend: 상영시간 생성 페이지를 방문
Frontend -> Backend: 영화 목록 요청\nGET /showtime-creation/movies
Frontend <-- Backend: movies[]
Admin <-- Frontend: 영화 목록 제공

Admin -> Frontend: 영화 선택
Frontend -> Backend: 극장 목록 요청\nGET /showtime-creation/theaters
Frontend <-- Backend: theaters[]
Admin <-- Frontend: 극장 목록 제공

Admin -> Frontend: 극장 선택
Frontend -> Backend: 상영시간 목록 요청\nPOST /showtime-creation/showtimes/search
note right
SearchShowtimesByTheatersBodyDto {
theaterIds
}
end note

    Frontend <-- Backend: showtimes[]

Admin <-- Frontend: 상영시간 목록 제공

Admin -> Admin: 상영시간 선택

Admin -> Frontend: 상영시간 생성 요청
Frontend -> Backend: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
note right
BulkCreateShowtimesDto {
movieId,
theaterIds,
startTimes,
durationInMinutes
}
end note
Frontend <-- Backend: Created(201)
Admin <-- Frontend: 상영시간 생성 성공 화면

@enduml
{% endplantuml %}

DTO 이름은 요청이 하는 일을 그대로 담아 짓는다. 생성 요청은 극장 여러 개에 회차 여러 개를 한 번에 만드니 `BulkCreateShowtimesDto`, 검색 요청은 극장 기준으로 본문(body)을 받아 검색하니 `SearchShowtimesByTheatersBodyDto`다. 이름이 길다고 느낄 수 있지만, DTO 이름은 자주 타이핑하는 이름이 아니라 자주 읽는 이름이다.

### 4.6. 실물 대조

이 설계는 그대로 nest-seed 저장소에 있다. [showtime-creation.http-controller.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway/showtime-creation.http-controller.ts)를 열어보자. 흐름 순서대로 발췌하고 메서드 본문은 생략했다.

```ts
@Controller('showtime-creation')
@UseGuards(AdminAuthGuard)
export class ShowtimeCreationHttpController {
    @Get('movies')
    async searchMoviesPage(@Query() searchDto: PaginationDto) { ... }

    @Get('theaters')
    async searchTheatersPage(@Query() searchDto: PaginationDto) { ... }

    @HttpCode(HttpStatus.OK)
    @Post('showtimes/search')
    async searchShowtimesByTheaterIds(@Body() body: SearchShowtimesByTheatersBodyDto) { ... }

    @HttpCode(HttpStatus.ACCEPTED)
    @Post('showtimes')
    async requestShowtimeCreation(@Body() createDto: BulkCreateShowtimesDto) { ... }

    @Sse('event-stream')
    getEventStream(): Observable<MessageEvent> { ... }
}
```

몇 가지가 눈에 들어온다.

첫째, `/showtime-creation` 네임스페이스가 `@Controller('showtime-creation')` 한 줄이다. 우리가 종이 위에서 정한 네임스페이스가 컨트롤러 클래스 하나와 일대일로 대응한다. 설계 문서의 단위와 코드의 단위가 같으면 문서와 코드를 오가는 비용이 줄어든다.

둘째, 유스케이스 명세서의 선행 조건 "관리자는 시스템에 로그인해야 합니다"가 `@UseGuards(AdminAuthGuard)`로 착지했다. 영화 목록 조회부터 생성 요청까지 이 흐름의 모든 엔드포인트는 관리자 전용이므로, 메서드마다 붙이지 않고 클래스 레벨에 한 번 걸었다. 가드 구현은 [admin-auth.guard.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway/guards/admin-auth.guard.ts)다. 명세서의 문장 하나가 코드 한 줄이 되는 이 대응이 2장에서 예고한 것이다.

셋째, `GET /showtime-creation/movies`와 `GET /showtime-creation/theaters`는 `PaginationDto`를 받는다. 극장이 4,000개인데 목록을 통째로 내려줄 수는 없으니 페이지로 끊어 받는다. 4.4에서 검색 API의 형태를 바꾼 그 숫자가 목록 API에서는 페이지네이션을 요구한 것이다.

넷째, DTO도 실물이 있다. [bulk-create-showtimes.dto.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/showtime-creation/dtos/bulk-create-showtimes.dto.ts)를 열어보면 `movieId`·`theaterIds`·`startTimes`·`durationInMinutes` 네 필드가 검증 데코레이터와 함께 정의되어 있고, [search-showtimes-by-theaters.body.dto.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/showtime-creation/dtos/search-showtimes-by-theaters.body.dto.ts)는 `theaterIds` 하나를 받는다. 다이어그램의 노트와 필드가 정확히 같다.

그런데 설계와 다른 곳이 두 군데 있다.

우리는 `POST /showtime-creation/showtimes`의 응답을 `Created(201)`로 설계했는데, 실물에는 `@HttpCode(HttpStatus.ACCEPTED)`가 붙어있다. 201이 아니라 202다. 그리고 우리가 설계한 적 없는 엔드포인트가 하나 더 있다. `@Sse('event-stream')`.

201 Created는 "요청한 것을 만들었다"는 뜻이고 202 Accepted는 "요청을 받아두었다, 만드는 건 나중이다"라는 뜻이다. 지금 우리의 설계는 요청 안에서 상영시간 생성이 끝난다고 가정하고 있다. 실물은 그 가정을 버렸다는 얘기다.

왜 버렸을까? 다음 글에서 최우선 요구사항의 숫자를 다시 대입해 보면 드러난다. 극장 4,000개가 4.4에서 API의 형태를 바꾼 것처럼, 이번에는 응답 계약 자체를 무너뜨린다. 지금은 201로 두고 넘어가되, 이 계약이 유지될 수 없다는 것만 기억해 두자. `event-stream`이라는 이름도 그때 다시 만난다.

## 5. 이 API는 누가 처리하는가

REST API를 정의했다면 이제 이 API를 처리할 서비스를 어디에 놓을지 정해야 한다.

### 5.1. 도메인별 서비스로 시작하기

가장 자연스러운 출발점은 유스케이스 다이어그램에 이미 있다. movies, theaters, showtimes, tickets라는 패키지가 그대로 서비스 후보가 된다. 각 도메인의 데이터를 소유하고 그 데이터에 대한 기능을 제공하는 서비스다.

이 서비스들에게 API를 나눠주면 이렇게 된다. 편의를 위해서 `Admin` 액터는 생략한다.

{% plantuml %}
@startuml
participant Frontend as frontend
participant Controller as controller
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes

frontend -> controller: 영화 목록 요청\nGET /showtime-creation/movies
controller -> movies: searchMovies()
controller <-- movies: movies[]
frontend <-- controller: movies[]

frontend -> controller: 극장 목록 요청\nGET /showtime-creation/theaters
controller -> theaters: searchTheaters()
controller <-- theaters: theaters[]
frontend <-- controller: theaters[]

frontend -> controller: 상영시간 목록 요청\nPOST /showtime-creation/showtimes/search
note right
SearchShowtimesByTheatersBodyDto {
theaterIds
}
end note
controller -> showtimes: searchShowtimes(theaterIds)
controller <-- showtimes: showtimes[]
frontend <-- controller: showtimes[]

frontend -> controller: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
note right
BulkCreateShowtimesDto {
movieId,
theaterIds,
startTimes,
durationInMinutes
}
end note
controller -> showtimes: createShowtimes(createDto)
showtimes -> movies: moviesExist(movieId)
showtimes <-- movies: true

        showtimes -> theaters: theatersExist(theaterIds)
        showtimes <-- theaters: true

        showtimes -> showtimes: saveShowtimes(createDto)
    controller <-- showtimes: showtimes[]

frontend <-- controller: Created(201)

@enduml
{% endplantuml %}

조회 세 개는 각자의 도메인 서비스가 처리하면 되니까 고민할 것이 없다. 문제는 마지막 생성 요청이다. 상영시간을 만들려면 영화가 존재하는지, 극장이 존재하는지 검증해야 하므로 `ShowtimesService`가 `MoviesService`와 `TheatersService`를 호출하고 있다. 이 시퀀스 다이어그램에서 그나마 복잡해 보이는 부분이 이 정도라서, 언뜻 보면 괜찮은 설계 같다.

### 5.2. 서비스가 서로를 부르기 시작하면

객체 지향 프로그래밍(OOP)에서 두 객체가 서로를 참조하면 참조 카운팅 방식의 환경에서는 메모리 누수 등의 문제가 생길 수 있기 때문에 피해야 한다고 한다. 그러나 이런 기술적인 문제보다 더 중요한 것은 두 객체가 강하게 결합한다는 것이다.

예를 들면 클래스 A, B가 서로를 참조한다고 할 때, A를 변경하면 B가 영향을 받고 그래서 B를 변경하면 다시 A가 영향을 받는다. 이런 관계는 A, B가 사실상 한 객체로 묶이는 것과 같다.

{% plantuml %}
@startuml

class A
class B
A -> B : uses
B -> A : uses

@enduml
{% endplantuml %}

서비스도 클래스와 같은 문제를 갖는다. 서비스는 자기 데이터를 소유하고 기능을 노출한다는 점에서 클래스의 확대판이기 때문이다.

그런데 위에서 그린 설계는 서비스가 다른 서비스를 자유롭게 부를 수 있다는 것을 전제하고 있다. 이 전제가 어디로 흘러가는지 보자. 지금은 `ShowtimesService`가 `MoviesService`를 부른다. 몇 달 뒤에 "심야 영화만 모아 보여달라"는 요구사항이 들어온다. 23시 이후에 상영하는 영화 목록이니까 당연히 `MoviesService`의 일이고, 상영시간을 알아야 하니까 `MoviesService`가 `ShowtimesService`를 부른다.

{% plantuml %}
@startuml
participant Frontend as frontend
participant Controller as controller
participant "Movies\nService" as movies
participant "Showtimes\nService" as showtimes

frontend -> controller: 상영시간 생성 요청
controller -> showtimes: createShowtimes(createDto)
showtimes -> movies: moviesExist(movieId)
showtimes <-- movies: true
controller <-- showtimes: showtimes[]
frontend <-- controller: Created(201)

frontend -> controller: 23시 이후에 상영하는 영화 목록 요청
controller -> movies: searchMovies()
movies -> showtimes: searchShowtimes()
movies <-- showtimes: showtimes[]
controller <-- movies: movies[]
frontend <-- controller: movies[]
@enduml
{% endplantuml %}

각각의 기능은 전부 그 자리에 있는 것이 자연스럽다. 어느 한 줄도 잘못 짠 코드가 없다. 그런데 두 기능을 합치면 `MoviesService`와 `ShowtimesService`가 서로를 부르는 순환 참조가 완성된다. 이제 `MoviesService`의 검색 조건을 바꾸면 `ShowtimesService`의 검증이 영향을 받는지 확인해야 하고, `ShowtimesService`의 검색 결과 형태를 바꾸면 `MoviesService`의 심야 영화 목록이 깨지는지 확인해야 한다. 두 서비스는 이름만 둘이지 사실상 한 덩어리다.

기능이 늘어날수록 이런 화살표는 계속 늘어난다. 티켓을 만들려면 `TicketsService`가 `ShowtimesService`와 `TheatersService`를 알아야 하고, 환불 내역을 보여주려면 또 어딘가가 어딘가를 불러야 한다.

{% plantuml %}
@startuml
skinparam componentStyle rectangle

component MoviesService as movies
component TheatersService as theaters
component ShowtimesService as showtimes
component TicketsService as tickets

showtimes --> movies
movies --> showtimes
showtimes --> theaters
tickets --> showtimes
tickets --> theaters
theaters --> tickets

note bottom of tickets
기능이 몇 개 늘었을 뿐인데
의존 관계가 그물이 된다
end note
@enduml
{% endplantuml %}

한 서비스를 고칠 때 영향 범위를 추적할 수 없다면 도메인별로 서비스를 나눈 의미가 없다. 나누는 목적이 바로 영향 범위를 좁히는 것이기 때문이다.

### 5.3. 해법은 규칙이다

문제를 다시 정리하면 이렇다. 서비스는 협력해야 하므로 서로를 불러야 하는데, 자유롭게 부르게 두면 순환 참조로 묶여서 나눈 의미가 사라진다. 협력은 허용하되 순환은 금지해야 한다.

인터페이스를 끼워 넣어서 참조 방향을 숨기는 방법도 있지만, 가장 좋은 것은 애초에 순환이 생길 수 없는 구조를 만드는 것이다. 즉, 누가 누구를 부를 수 있는지에 대한 **규칙**이 필요하다.

nest-seed는 이 규칙을 SoLA(Service-oriented Layered Architecture)라는 이름의 계층 구조로 강제한다. 어떤 계층이 있고 왜 그 모양인지, 그리고 `상영시간 생성하기`가 어느 계층에 놓이는지는 다음 글에서 자세히 다룬다. 여기서는 한 가지 사실만 미리 밝혀둔다.

nest-seed는 마이크로서비스가 아니다. `MoviesService`, `ShowtimesService` 같은 서비스들이 각자의 컬렉션을 소유하고 정해진 통로로만 협력하지만, 배포되는 것은 모놀리스 하나다. 서비스 경계는 프로세스가 아니라 코드에 있고, 계층 규칙은 배포 인프라가 아니라 린트가 강제한다. 경계가 코드에 있으면 배포 형태는 나중에 필요할 때 바꿀 수 있다. 반대로 경계 없이 배포만 쪼개면 순환 참조가 네트워크 호출로 모습만 바꿔서 그대로 남는다.

방금 그린 그물 다이어그램의 서비스들은 실물에도 있다. [movies.service.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/core/movies/movies.service.ts), [showtimes.service.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/core/showtimes/showtimes.service.ts), [theaters.service.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/core/theaters/theaters.service.ts)다. 다만 실물에서는 이 서비스들 사이에 화살표가 하나도 없다. 그물이 어떻게 사라졌는지가 다음 글의 내용이다.

## 6. 결론

이번 글에서는 `상영시간 생성하기` 유스케이스에 대해 (1) 유스케이스 명세서를 작성하고, (2) 시퀀스 다이어그램으로 시각화한 뒤, (3) REST API를 설계하고 실물 컨트롤러와 대조했다.

네임스페이스 `/showtime-creation`은 컨트롤러 클래스 하나로, 선행 조건은 가드 한 줄로, 극장 4,000개라는 요구사항은 POST 검색과 페이지네이션으로 착지했다. 설계 문서의 개념 단위와 코드 단위가 대응하면 문서가 코드를 안내하고 코드가 문서를 검증한다.

풀지 않은 문제가 둘 남았다. 실물 컨트롤러가 201 대신 202를 반환하는 이유, 그리고 도메인 서비스들이 순환 참조 없이 협력하는 방법이다. 두 문제 모두 다음 글에서 다룬다. 하나는 최우선 요구사항의 숫자가, 다른 하나는 계층 규칙이 답이다.

---

이전 글: [백엔드 서비스 분석과 설계 — nest-seed로 증명하기 (1)]({% post_url 2026-07-02-nest-seed-design-1 %})
