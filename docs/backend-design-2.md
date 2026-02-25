---
layout: post
title: 백엔드 서비스 분석과 설계 (2)
---

우리는 지난 시간에 `Movie Booking System`의 유스케이스 다이어그램을 그렸다. 소프트웨어 분석/설계 과정에서 유스케이스 다이어그램을 그렸다면, 이는 성공적인 출발이라 할 수 있다.

이번 시간에는 여러 유스케이스 중에서 절차가 복잡해 보이는 두 유스케이스인 `상영시간 생성하기`와 `티켓 구매하기`에 대해서 좀 더 분석해 보도록 하겠다.

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

`상영시간 생성하기`와 `티켓 구매하기` 중 어떤 것을 먼저 분석하는 것이 좋을까? 나는 보통 데이터를 **생성하는** 유스케이스부터 시작하는 편이다. 조회 기능은 전제 데이터가 있어야 의미를 파악할 수 있기 때문이다.

여기서는 티켓을 생성해야 티켓을 구매할 수 있기 때문에 `상영시간 생성하기` 유스케이스를 먼저 분석해 본다.

## 2. `상영시간 생성하기` 유스케이스 명세서

우리는 도메인 전문가에게 상영시간을 생성하려면 어떤 절차가 필요한지 물어본 뒤, 아래와 같이 정리한다.

**목표**: 영화의 상영시간 생성하기

**액터**: Admin

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
- 상영시간에 해당하는 티켓이 생성되어야 한다.

CreateShowtimes의 시작 조건인 `트리거`를 정의하고, 그에 따른 `기본 흐름`을 정리했다. 그 외에 `대안 흐름`과 `사후 조건` 등을 보면 `Movie Booking System`에서 무슨 일을 해야 할지 가늠할 수 있다.

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

이 시퀀스 다이어그램은 `액터`, `트리거`, `기본 흐름`에 대한 내용을 담고있고 `대안 흐름`은 빠져있다.

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

프레임이 중첩되니까 분석 단계의 문서임에도 불구하고 복잡해 보인다. 무엇이 옳은지는 프로젝트 마다 다르지만 여기서는 `대안 흐름`을 분리하는 것이 좋아 보인다.

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
durationInSeconds
}
end note
Frontend <-- Backend: Created(201)
Admin <-- Frontend: 상영시간 생성 성공 화면
@enduml
{% endplantuml %}

이것은 경로를 짧게 가져가는 전형적인 Shallow Routing 설계로, URI를 짧고 평탄하게 유지해 주면서 서비스 진화·운용 부담을 덜어 주는 실용적 선택이다.

### 4.2. Namespace 추가

Shallow Routing 방식은 몇 가지 단점이 있다. 현재는 프로젝트 초기 단계이기 때문에 요청이 간단하지만 프로젝트가 진행되고 요구사항이 구체화될수록 API가 빈번히 변경될 수 있다. 예를 들면 이렇게 말이다.

```sh
GET /movies?orderby=releaseDate:desc&includes=showtime-summary
GET /theaters?orderby=name:asc&includes=showtime-count
```

API의 조건이 복잡해질수록 이것을 처리해야 하는 백엔드의 구현 부담이 증가한다. API를 사용하는 프론트엔드도 API 스펙을 파악하고 구현해야 하는 부담이 생긴다.

소프트웨어 개발은 요구사항이 계속 변경되기 때문에 유연성을 중시한다. 그러나 API에서 유연성을 제공한다는 것은 그 만큼 사용과 구현이 어려워진다는 뜻이다.

불특정 다수를 대상으로 하는 서비스라면 유연성을 높여서 구체적인 구현을 사용자(여기서는 프론트엔드)에게 맡기는 것이 옳은 선택일 것이다. 그러나 지금은 `상영시간 생성`이라는 명확한 목적을 가진 요청이라는 것을 알고있는 상황이다. 그렇다면 API도 이 상황을 잘 나타낼 수 있게 정의하는 것이 합리적일 것이다.

```sh
GET /showtime-creation/movies
GET /showtime-creation/theaters
```

이렇게 정의하면 이제 `상영시간 생성`의 요구사항이 크게 변경되지 않는 한 API를 변경할 필요는 없을 것이다.

이런 방식을 누군가는 컨텍스트 컨트롤러 패턴이라고 부르는 것 같기는 한데 표준으로 정해진 이름은 없는 것 같다. 이런 방식에 패턴이라는 이름까지 붙여야 하나 싶은 생각이 있어서 여기서는 `/showtime-creation`을 그냥 `네임스페이스`라고 정의한다.

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

Bottom-Up(데이터·구현 우선) 접근은 **현재 파악 가능한 테이블 중심으로 DDL을 먼저 정의**하고, 그 스키마를 그대로 노출하는 CRUD API를 작성한다. 이후 새로운 기능 요구가 생기면 기존 구현 범위 안에서 해결책을 찾으려 하기 때문에, **‘상영 시간 생성’**과 같은 상위 개념이 여러 API로 흩어져 응집도가 약해질 수 있다.

반대로 Top-Down(개념 우선) 접근은 **‘상영 시간 생성’이라는 도메인 엔티티/유스케이스를 기점으로** 필요한 단계를 정의하고, 그 흐름에 맞춰 엔드포인트 경로를 설계한다. 그래서 자연스럽게 \*\*`/showtime-creation/` 와 같은 네임스페이스를 떠올릴 수 있다.

두 방법 모두 장단이 있으나, 본질 기반 해석(EBI) 관점에서는 **Top-Down**이 도메인 개념과 API 구조를 일관되게 유지하기 쉽다.

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

이렇게 긴 쿼리 파라미터가 예상되는 API는 POST 방식으로 정의하기로 한다.

```sh
POST /showtime-creation/showtimes/search
{
    theaterIds:[]
}
```

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
SearchShowtimesDto {
theaterIds,
}
end note

    Frontend <-- Backend: showtimes[]

Admin <-- Frontend: 상영시간 목록 제공

Admin -> Admin: 상영시간 선택

Admin -> Frontend: 상영시간 생성 요청
Frontend -> Backend: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
note right
CreateShowtimesDto {
movieId,
theaterIds,
startTimes,
durationInSeconds
}
end note
Frontend <-- Backend: Created(201)
Admin <-- Frontend: 상영시간 생성 성공 화면

@enduml
{% endplantuml %}

## 5. 서비스 설계

REST API를 정의했다면 이제 REST API와 연결되는 서비스를 설계해 보자.

### 5.1. 마이크로서비스 아키텍쳐(MSA) 소개

서비스 설계를 시작하기 전에 프로젝트와 개발팀의 상황을 고려해서 최상위 아키텍쳐를 정해야 한다. 여기서는 마이크로서비스 아키텍쳐(MSA)를 선택했다.

MSA의 가장 큰 특징은 작은 서비스들이 협력해서 서비스를 제공한다는 것이다. 이 때 중요한 점은 서비스 간에 DB를 공유하지 않는다는 것이다.

마이크로서비스의 이런 특징은 객체 지향 프로그래밍의 클래스와 유사하다고 볼 수 있다.

{% plantuml %}
@startditaa
+----------------------+ +----------------------+
| Class |<------>| Microservice |
+----------------------+ +----------------------+
| | | |
| - Property |<------>| - Database |
| | | |
+----------------------+ +----------------------+
| | | + API |
| + Method() |<------>| + GET /resource |
| | | + POST /resource |
+----------------------+ +----------------------+
@endditaa
{% endplantuml %}

결국 MSA는 개념적으로 객체 지향 방식과 유사한 면을 가지게 된다.

### 5.2. MSA로 서비스 설계

그러면 이제 MSA에 맞게 서비스를 설계해 보자. 편의를 위해서 `Admin`액터는 생략한다.

{% plantuml %}
@startuml
Frontend -> Gateway: 영화 목록 요청\nGET /showtime-creation/movies
Gateway -> MoviesService: searchMovies()
Gateway <-- MoviesService: movies[]
Frontend <-- Gateway: movies[]

Frontend -> Gateway: 극장 목록 요청\nGET /showtime-creation/theaters
Gateway -> TheatersService: searchTheaters()
Gateway <-- TheatersService: theaters[]
Frontend <-- Gateway: theaters[]

Frontend -> Gateway: 상영시간 목록 요청\nPOST /showtime-creation/showtimes/search
note right
SearchShowtimesDto {
theaterIds,
}
end note
Gateway -> ShowtimesService: searchShowtimes(searchDto)
Gateway <-- ShowtimesService: showtimes[]
Frontend <-- Gateway: showtimes[]

Frontend -> Gateway: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
note right
CreateShowtimesDto {
movieId,
theaterIds,
startTimes,
durationInSeconds
}
end note
Gateway -> ShowtimesService: createShowtimes(createDto)
ShowtimesService -> MoviesService: moviesExist(movieId)
ShowtimesService <-- MoviesService: true

        ShowtimesService -> TheatersService: theatersExist(theaterIds)
        ShowtimesService <-- TheatersService: true

        ShowtimesService -> ShowtimesService: createShowtimes(createDto)
    Gateway <-- ShowtimesService: showtimes[]

Frontend <-- Gateway: Created(201)

@enduml
{% endplantuml %}

이 시퀀스 다이어그램에서 그나마 복잡해 보이는 부분은 ShowtimesService의 createShowtimes() 함수에서 검증을 위해 MoviesService.moviesExist()와 TheatersService.theatersExist()를 호출하고 있다는 정도다.

### 5.3. 마이크로서비스의 순환 참조 문제

객체 지향 프로그래밍(OOP)에서 두 객체가 서로를 참조하면 메모리 관리 등의 문제가 생기기 때문에 피해야 한다고 한다. 그러나 이런 기술적인 문제보다 더 중요한 것은 두 객체가 강하게 결합한다는 것이다.

예를 들면 클래스A, B가 서로를 참조한다고 할 때, A를 변경하면 B가 영향을 받고 그래서 B를 변경하면 다시 A가 영향을 받는다. 이런 관계는 A, B가 사실상 한 객체로 묶이는 것과 같다.

{% plantuml %}
@startuml

class A
class B
A -> B : uses
B -> A : uses

@enduml
{% endplantuml %}

이 문제를 해결하기 위해서 인터페이스를 생각해 볼 수 있겠지만 가장 좋은 것은 순환 참조 관계를 만들지 않는 것이다.

MSA가 OOP와 유사한 특징을 가지는 만큼 MSA도 순환 참조를 피해야 한다. 그런데 위에서 설계한 마이크로서비스는 순환 참조 문제가 발생할 가능성이 높다. MoviesService에 ShowtimesService를 참조하는 기능은 얼마든지 추가될 수 있기 때문이다.

{% plantuml %}
@startuml
Frontend -> Gateway: 상영시간 생성 요청
Gateway -> ShowtimesService: createShowtimes(createDto)
ShowtimesService -> MoviesService: moviesExist(movieId)
ShowtimesService <-- MoviesService: true
Gateway <-- ShowtimesService: showtimes[]
Frontend <-- Gateway: Created(201)

Frontend -> Gateway: 23시 이후에 상영하는 영화 목록 요청
Gateway -> MoviesService: searchMovies()
MoviesService -> ShowtimesService: searchShowtimes()
MoviesService <-- ShowtimesService: showtimes[]
Gateway <-- MoviesService: movies[]
Frontend <-- Gateway: movies[]
@enduml
{% endplantuml %}

위 시퀀스 다이어그램에서 볼 수 있듯이 서비스가 다른 서비스를 참조할 수 있다는 것은 기능이 확장되면서 언젠가 상호 참조 관계로 발전할 수 있다는 뜻이다.

### 5.4. SoLA(Service-oriented Layered Architecture)

MSA는 ‘서비스 간 협력’과 ‘순환 참조 금지’라는 상충을 레이어 분리로 해결한다. 즉, 마이크로서비스는 하위 레이어만 참조할 수 있다는 `단방향 의존 관계` 규칙을 추가한다.

{% plantuml %}
@startuml
package "Application Services" {
[ShowtimeCreationService]
}

package "Core Services" {
[MoviesService]
[TheatersService]
[ShowtimesService]
[TicketsService]
}

package "Infrastructure Services" {
[PaymentsService]
}

[ShowtimeCreationService] --> [MoviesService]
[ShowtimeCreationService] --> [TheatersService]
[ShowtimeCreationService] --> [ShowtimesService]
[ShowtimeCreationService] --> [TicketsService]

[TicketsService] --> [PaymentsService]

note top of [ShowtimeCreationService]
**순환 참조는 엄격하게 금지한다**

1. **동일 계층 간 참조 금지**
2. 상위 계층만 하위 계층 참조 가능
3. Application → Core → Infrastructure
   end note
   @enduml
   {% endplantuml %}

이 프로젝트에서는 서비스를 `Application`, `Core`, `Infrastructure`로 구분하기로 한다.

- **Application Service**:
    - 사용자 시나리오를 조립합니다 (예: 주문 → 결제 → 알림).
    - Core/Infra 서비스 호출만 허용합니다.
    - 트랜잭션 관리를 주도합니다.
- **Core Service**:
    - 도메인의 기본 로직을 담당합니다 (예: 영화 관리, 극장 관리).
    - Infra 서비스 호출만 허용합니다.
- **Infrastructure Service**:
    - 결제, 스토리지 등 외부 시스템 연동을 담당합니다.

하나의 마이크로서비스를 설계할 때 `Application`, `Domain`, `Infrastructure` 레이어로 객체를 분류하듯이 마이크로서비스들도 유사하게 나누는 것이다.

이제 `SoLA`를 적용하여 다시 설계를 해보자.

{% plantuml %}
@startuml
participant Frontend as frontend
participant Gateway as gateway
participant "ShowtimeCreation\nService" as creation
participant "Movies\nService" as movies
participant "Theaters\nService" as theaters
participant "Showtimes\nService" as showtimes

frontend -> gateway: 영화 목록 요청\nGET /showtime-creation/movies
gateway -> creation: searchMovies()
creation -> movies: searchMovies()
creation <-- movies: movies[]
gateway <-- creation: movies[]
frontend <-- gateway: movies[]

frontend -> gateway: 극장 목록 요청\nGET /showtime-creation/theaters
gateway -> creation: searchTheaters()
creation -> theaters: searchTheaters()
creation <-- theaters: theaters[]
gateway <-- creation: theaters[]
frontend <-- gateway: theaters[]

frontend -> gateway: 상영시간 목록 요청\nPOST /showtime-creation/showtimes/search
note right
SearchShowtimesDto {
theaterIds,
}
end note
gateway -> creation: searchShowtimes(searchDto)
creation -> showtimes: searchShowtimes(searchDto)
creation <-- showtimes: showtimes[]
gateway <-- creation: showtimes[]
frontend <-- gateway: showtimes[]

frontend -> gateway: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
note right
CreateShowtimesDto {
movieId,
theaterIds,
startTimes,
durationInSeconds
}
end note
gateway -> creation: createShowtimes(createDto)
creation -> movies: moviesExist(movieId)
creation <-- movies: true

        creation -> theaters: theatersExist(theaterIds)
        creation <-- theaters: true

        creation -> showtimes: createShowtimes(createDto)
        creation <-- showtimes: showtimes[]
    gateway <-- creation: showtimes[]

frontend <-- gateway: Created(201)

@enduml
{% endplantuml %}

`/showtime-creation` 네임스페이스에 맞춰서 `ShowtimeCreationService` 서비스를 만들었다.
REST API와 서비스의 구조가 유사해지면서 구조 파악이 쉬워지는 장점까지 생겼다.

> 소프트웨어 개발은 분석/설계/구현/검증이 물 흐르듯이 자연스럽게 흘러가야 한다.

## 6. 결론

이번 글에서는 `상영시간 생성하기` 유스케이스에 대해 (1) 유스케이스 명세서를 작성하고, (2) 시퀀스 다이어그램으로 시각화한 뒤, (3) 서비스 설계를 위해 시퀀스를 확장했다.

최상위 아키텍처로 MSA를 선택하고, 서비스 간 순환 참조 문제를 SoLA(Service-oriented Layered Architecture)로 해결함으로써 REST API와 서비스 계층이 자연스럽게 대응되는 효과를 확인했다.

다음 글에서는 `상영시간 생성하기`의 부족했던 설계를 마무리 보완하고 관련 테스트를 작성할 것이다.
