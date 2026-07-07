---
layout: post
title: 백엔드 서비스 분석과 설계 — nest-seed로 증명하기 (1)
lang: ko
---

이 연재는 영화 예매 시스템을 예제로, 요구사항 분석에서 시작해 설계와 구현 순서, 테스트 작성까지를 순서대로 다룬다. 예전에 같은 주제로 쓴 연재([백엔드 서비스 분석과 설계]({% post_url 2025-04-01-backend-design-1 %}))의 개정판이다.

이번 연재가 앞세우는 약속은 하나다. **여기 나오는 설계는 종이 위에서 끝나지 않는다.** 전부 [nest-seed](https://github.com/mannercode/nest-seed)라는 실물 NestJS 모놀리스로 구현되어 있고, 글의 다이어그램과 결정마다 실물 코드를 가리킨다. 설계가 옳았는지는 문서가 아니라 실행이 판정한다. 그래서 이 연재는 각 단계의 끝에서 저장소를 열어, 설계가 실제로 그렇게 서 있는지 확인한다.

연재는 설계에서 출발해 테스트로 끝난다. 아무런 준비 없이 의미 있는 테스트를 먼저 작성하는 것은 결코 쉽지 않은데, 이는 소프트웨어 설계 역량이 함께 갖추어져야 가능한 일이기 때문이다. 이 연결이 말로 끝나지 않는다는 것도 실물로 보인다 — 커버리지 100% 게이트가 코드에 박혀 있다. 마지막 편에서 다룬다.

## 1. 목표 정하기

우리는 도메인 전문가와 첫 미팅을 한다. 도메인 전문가는 우리가 만들어야 할 시스템에 대해 많은 이야기를 해주는데, 주요 내용을 정리하면 다음과 같다.

1. 극장이 많다. 전국에 극장 4,000개 정도다. 물론 앞으로 더 늘어날 수 있다.
2. 현재는 영화 예매 기능만 지원하지만 향후에는 대형 공연 예매 기능도 추가할 예정이다.
3. 좌석이 중복 예약되면 안 된다. 예전에 그런 문제로 고객센터에서 고생을 많이 했다.
4. 기존에 사용하던 데이터는 그대로 유지해야 한다. 영화 정보나 감상평 등 이미 축적된 데이터가 많다.
5. 그 외, 기존 시스템을 운영하며 경험한 여러 불편 사항들...

도메인 전문가는 중요하다고 생각하는 정보를 최대한 많이 전달했지만, 개발자 입장에서는 추가적인 확인이 필요하다.

1. 대형 공연 예매 기능은 언제 추가될 예정인가? 이번 프로젝트의 범위에 포함해야 하는가?
2. 기존 데이터를 유지한다는 말은 DB 시스템을 바꾸면 안 된다는 의미인가? DB를 사용하는 다른 서비스가 있는가?

도메인 전문가는 이렇게 답변한다.

1. 대형 공연은 아직 구체적인 일정이 없다. 다만 향후 업그레이드를 수월하게 할 수 있도록 이번 프로젝트에서 어느 정도 고려하면 좋겠다.
2. DB를 사용하는 다른 서비스는 없다. 기존 데이터가 유지되기만 하면 된다.

이런 대화를 반복하면서 우리는 요구사항을 다음과 같이 정리할 수 있다.

```txt
최우선 요구사항

1. 극장은 4,000개 이상
2. 좌석 중복 예약 방지 필수
3. 기존 데이터 마이그레이션 필수
```

대형 공연에 관한 내용은 문서에서 빠졌는데, 프로젝트 범위가 아니고 요구사항이 명확하지도 않기 때문이다. 언제 필요할지 모르겠지만 그때 가서 다시 검토해야 하는 문제다.

이렇게 도메인 전문가가 전해주는 정보를 개발자 입장에서 해석하고 정리하는 것으로 프로젝트를 시작할 수 있다.

최우선 요구사항이라는 이름은 장식이 아니다. 앞으로 보겠지만 "극장 4,000개"라는 숫자 하나가 조회 API의 형태를 바꾸고(극장 ID 목록은 쿼리 스트링에 담을 수 없는 길이가 된다), 상영시간 등록을 동기 요청으로 처리할 수 없게 만들며, 결국 비동기 작업과 보상 처리까지 끌고 들어온다. "좌석 중복 예약 방지"는 이 시스템에서 가장 신경 써야 할 동시성 코드가 된다. 이후의 모든 설계 선택을 이 목록에 비추어 판단하게 될 것이다.

> 비록 문서에 기록하지 않더라도 도메인 전문가에게는 '대형 공연'도 잘 고려하겠다는 답변을 잊으면 안 된다.

## 2. 프로젝트 이름 정하기

도메인 전문가와 함께 프로젝트의 목표가 어느 정도 정해졌다면, 이제 프로젝트 이름을 정할 차례다.

우선 도메인 전문가에게 의견을 물어보자. 도메인 전문가는 자연스럽게 `영화 예매 시스템`이라는 이름을 제안한다.

{% plantuml %}
@startuml
left to right direction

package "영화 예매 시스템" {
usecase " "
}
@enduml
{% endplantuml %}

도메인 전문가의 입장에서는 한글로 된 `영화 예매 시스템`이 더 친숙하고 명확할지도 모른다. 하지만 개발자의 입장에서 보면, 프로젝트 이름을 포함한 모든 용어는 코드상으로 직접 구현되기 때문에 가급적 영어로 정의하는 것이 여러모로 유리하다.

그래서 우리는 도메인 전문가에게 이 점을 충분히 설명하고, `Movie Booking System`이라는 이름을 제안할 수 있다.

{% plantuml %}
@startuml
left to right direction

package "Movie Booking System" {
usecase " "
}
@enduml
{% endplantuml %}

앞서 '대형 공연 예매' 기능에 대해서도 신경 쓰겠다고 잘 전달했다면, 도메인 전문가는 흔쾌히 `Movie Booking System`이라는 이름을 받아들일 것이다.

> 혹시 순수하고 정직한 마음을 가진 개발자라면 '대형 공연'에 대해 신경 쓰지 않을 예정이라는 사실에 죄책감을 느낄지도 모르겠다. 하지만 걱정하지 않아도 된다. '대형 공연'이 정말 중요했다면 도메인 전문가는 처음부터 프로젝트 이름으로 '영화 예매 시스템'을 제안하지 않았을 것이다. 아마 '티켓 예매 시스템'이나 더 범용적인 '예매 시스템' 같은 이름을 제안했을 것이다. 그러니 지금 상황에서 '대형 공연'이란 요구사항은 그냥 가벼운 언급 정도로 받아들이면 된다.

실물 저장소의 이름이 Movie Booking System이 아니라 nest-seed인 이유도 여기서 짚어 두자. 저장소는 특정 서비스가 아니라 새 백엔드 프로젝트를 시작할 때 fork하는 시드이고, 영화 예매는 그 시드가 설계 패턴을 보여주기 위해 고른 예제 도메인이다. 대신 도메인의 용어들은 코드 안에 그대로 살아 있다. [apps/api/src/services/core/](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/core/)를 열면 movies, theaters, showtimes, tickets가 폴더 이름으로 서 있다. 프로젝트 이름부터 영어로 정하자고 한 이유가 이것이다. 분석 단계의 용어가 그대로 폴더와 클래스가 된다.

## 3. 사용자

프로젝트의 이름을 정했다면 이제 누가 `Movie Booking System`을 사용하는지 알아볼 차례다.

물론 이에 대한 정보는 도메인 전문가가 알고 있을 것이고, 그렇게 우리는 `customer`와 `administrator`의 존재를 알게 된다.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator

package "Movie Booking System" as mbs {
usecase " "
}

customer --> mbs
administrator --> mbs
@enduml
{% endplantuml %}

그런데 여기서 한 가지를 더 물어야 한다. 액터는 도메인 전문가의 입에서만 나오지 않는다.

`administrator`가 시스템에 로그인하려면 admin 계정이 있어야 한다. 그런데 그 계정은 누가 만드는가? 첫 번째 admin은? 도메인 전문가는 이 질문에 관심이 없다. 극장과 영화의 세계에 admin 계정 발급이라는 업무는 없기 때문이다. 이것은 도메인이 아니라 운영에서 나오는 요구다.

그래서 실물에는 액터가 하나 더 있다. `root`다.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
actor root

package "Movie Booking System" as mbs {
usecase " "
}

customer --> mbs
administrator --> mbs
root ..> administrator : admin 계정을 만든다
@enduml
{% endplantuml %}

실물과 대응시키면 이렇다.

- `customer`는 시드의 **user 역할**이다. 가입·로그인부터 본인 자원 관리까지 [users.http-controller.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway/users.http-controller.ts)가 진입점이다.
- `administrator`는 시드의 **admin 역할**이다. 영화·극장 등록 같은 콘텐츠 작업과 임의 사용자 대상 작업을 맡는다.
- `root`는 admin 계정을 만들고 지우는 일만 하는 **운영용 역할**이다. JWT 토큰이 아니라 환경 변수에 둔 자격증명의 Basic 인증으로 동작하고([root-auth.guard.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway/guards/root-auth.guard.ts)), 할 수 있는 일은 [admins.http-controller.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway/admins.http-controller.ts)의 admin 생성·삭제뿐이다.

root를 분석 단계에서 못 찾았다고 자책할 일은 아니다. 다만 교훈은 챙겨 두자. 액터를 찾을 때 "이 시스템을 쓰는 사람"만 물으면 도메인 액터만 나온다. "이 시스템을 **돌리는** 사람"까지 물어야 운영 액터가 나온다.

## 4. 외부 의존 관계

설계 초기에 놓치기 쉬운 요소 중 하나가 바로 외부 의존성이다.

외부 의존성이란 기존에 존재하는 레거시 시스템일 수도 있고, 결제 시스템일 수도 있다. 이러한 의존 관계는 전체 시스템 설계에 큰 영향을 미칠 수 있기 때문에, 가능하면 초기에 명확히 파악하는 것이 좋다.

다행히도 `Payment Gateway`나 `Legacy System` 같은 요소들은 기존 시스템에서 이미 사용하고 있기 때문에 비교적 수월하게 파악할 수 있다.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle "Payment Gateway" as payment
rectangle "Legacy System" as legacy

package "Movie Booking System" as mbs {
usecase " "
}

customer --> mbs
administrator --> mbs
mbs --> payment
mbs --> legacy
@enduml
{% endplantuml %}

이 밖에도 흔히 간과하기 쉬운 외부 환경 요소들이 존재한다. 예를 들어, 전국에 분포된 극장들이 서로 다른 시간대에 위치해 있다면, 우리의 `Movie Booking System`은 자연스럽게 `Time Zone`이라는 환경적 요소에 영향을 받을 수밖에 없다.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle "Payment Gateway" as payment
rectangle "Legacy System" as legacy
rectangle "Time Zone" as timezone

package "Movie Booking System" as mbs {
usecase " "
}

customer --> mbs
administrator --> mbs
mbs --> payment
mbs --> legacy
mbs --> timezone
@enduml
{% endplantuml %}

이런 요소들은 도메인 전문가에게 직접 물어보지 않으면 놓치기 쉽다. 도메인 전문가는 이 부분을 너무 당연하게 여겨 설명을 생략할 수도 있기 때문이다.

개발자에 따라서는 `Time Zone`을 유스케이스 다이어그램에 넣는 것을 부자연스럽게 느낄 수도 있다. UML을 어떻게 사용해야 한다고 엄격하게 규정할 필요는 없다. 개발하려는 시스템의 의존 관계를 표현하는 데 있어서 모두가 이해하기 쉬운 방법이라면 얼마든지 허용 가능하다.

> 추상적인 생각을 물리적인 형태로 표현하려면 충분히 유연한 도구여야 한다.

아참, 위의 다이어그램은 사실 Context Diagram이다. 용어 자체에 집중하면 본질에 다소 소홀해지기 쉬운 것 같다. 그래서 이후 설명에서도 전문용어 사용을 최소화하려고 한다.

외부 의존이 실물에서 어디로 갔는지도 확인해 두자. 시드는 외부 시스템 연동을 Infrastructure라는 별도 계층에 모은다. 결제 연동의 자리는 [payments.service.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/infrastructure/payments/payments.service.ts)가 잡고 있다. 예제 프로젝트라 실제 결제사 API를 붙이는 대신 결제 기록을 만들고 취소하는 형태로 두었지만, 요점은 그 코드가 아니라 위치다. 외부 의존을 한 계층에 격리해 두면, 진짜 결제사를 붙이는 날 바뀌는 곳이 거기 하나로 끝난다. 분석 단계에서 외부 의존을 따로 그려 두는 수고는 구현 단계에서 이렇게 돌아온다.

## 5. 유스케이스

의존 관계까지 명시하면서 대략적인 개발 범위를 파악한 것 같다. 이제 본격적으로 `Movie Booking System`의 내부에 집중해 보자.

일단, 편의를 위해서 의존 관계는 숨기고 사용자만 남겨 놓는다.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator

package "Movie Booking System" as mbs {
usecase " "
}

customer --> mbs
administrator --> mbs
@enduml
{% endplantuml %}

여기서 드는 궁금증은 `customer`와 `administrator`가 `Movie Booking System`에서 무엇을 하는가이다. 결국 그것이 `Movie Booking System`이 제공해야 하는 기능일 테니까 말이다.

### 5.1. customer의 유스케이스

`customer`가 `Movie Booking System`에서 무슨 일을 하는지 도메인 전문가에게 물어보니 이렇게 알려준다.

- 영화 검색하기
- 영화 상세 정보 보기
- 상영 시간 선택하기
- 좌석 선택하기
- 영화 예매하기
- 예매 내역 확인하기
- 예매 취소하기

우리는 도메인 전문가에게 다시 확인을 해본다.

- `상영 시간 선택하기`, `좌석 선택하기`는 `영화 예매하기`의 한 과정인가?
- `영화 예매하기`, `예매 취소하기`는 결국 티켓을 구입하고 환불하는 것 아닌가?

개발자의 질문에 도메인 전문가는 맞다고 확인을 해준다. 그래서 우리는 아래와 같이 유스케이스를 정리할 수 있다.

{% plantuml %}
@startuml
left to right direction
actor customer

package "Movie Booking System" as mbs {
usecase "영화 상세보기" as MovieDetails
usecase "영화 검색하기" as SearchMovies
usecase "티켓 구매하기" as PurchaseTickets
usecase "티켓 환불하기" as RefundTickets
}

customer --> mbs
@enduml
{% endplantuml %}

우리는 도메인 전문가가 아니다. 그런데 어떻게 `상영 시간 선택하기`와 `좌석 선택하기`가 `영화 예매하기`의 한 과정이냐고 물어볼 수 있었을까?

예를 들어 `상영 시간 선택하기`에 대해서 도메인 전문가에게 이렇게 물어볼 수 있다.

1. 상영 시간 선택하기가 뭐죠?
1. 화면에 뭐가 있어야 하죠?
1. 영화가 선택되어 있어야 할 것 같은데 다른 사전 조건은 뭔가요?

이렇게 각각의 케이스에 대해 사용자와 어떤 액션을 주고받는지 따져 보면 유스케이스가 자연스럽게 정리된다. 프로젝트 상황에 따라서 이 과정을 몇 번씩 반복할 수도 있지만 여유를 갖고 세심하게 분석할수록 설계와 구현 단계에서 시행착오를 줄일 수 있다.

이 문답에 각주를 하나 달아 두자. 분석 단계의 접기는 삭제가 아니라 보류다. 지금은 문서를 단순하게 유지하기 위해 접지만, 접힌 흐름이 자기 이름을 가질 만큼 중요하다면 구현 단계에서 돌아온다. 실물이 그 증거다. `티켓 구매하기` 안으로 접어 넣은 `상영 시간 선택하기`와 `좌석 선택하기`는 예매 동선을 책임지는 [BookingService](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/booking/booking.service.ts)라는 자기 이름을 얻었다. 상영시간을 고르고 좌석을 선점하는 흐름이 통째로 booking이라는 유스케이스가 된 것이다.

유스케이스 이름을 짓는 요령도 하나 챙겨 두자. **이름은 영어로 짓는다.** 프로젝트 이름에서 했던 이야기와 같은 이유인데, 유스케이스 이름은 그대로 코드가 되기 때문이다. 위 다이어그램의 `PurchaseTickets`는 실물에서 [PurchaseService](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/purchase/purchase.service.ts)라는 클래스가 됐다. 다이어그램의 한글은 도메인 전문가와 대화하기 위한 표기이고, 코드가 되는 것은 영어 별칭 쪽이다. 분석 단계에서 영어 이름을 미리 합의해 두면 구현 단계에서 번역이라는 불확실한 작업이 사라진다.

### 5.2. administrator의 유스케이스

`administrator`는 무슨 일을 할까? 관리자니까 당연히 관리를 할 것이다. 무엇을 관리할까?

1. 영화 관리
2. 극장 관리
3. 고객 관리
4. 티켓 관리
5. 상영 시간 관리

{% plantuml %}
@startuml
left to right direction
actor administrator

package "Movie Booking System" as mbs {
usecase MoviesManage
usecase TheatersManage
usecase CustomersManage
usecase TicketsManage
usecase ShowtimesManage
}

administrator --> mbs
@enduml
{% endplantuml %}

개인적으로 개발에서 manage라는 단어를 조심하는 편이다. manage는 표현이 너무 포괄적이라서 무슨 일을 하는지 모호하다. "티켓 관리"라고 적어 놓으면 추가인지, 검색인지, 생성인지 알 수 없고, 알 수 없는 채로는 설계가 시작되지 않는다. 도메인 전문가와 함께 좀 더 세분화해 보자.

{% plantuml %}
@startuml
left to right direction
actor administrator
rectangle "Payment Gateway" as PaymentGateway

package "Movie Booking System" as mbs {
package theaters {
usecase "극장 추가하기" as AddTheaters
}

    package movies {
        usecase "영화 추가하기" as AddMovies
    }

    package customers {
        usecase "고객 검색하기" as SearchCustomers
    }

    package showtimes {
        usecase "상영 시간 생성하기" as CreateShowtimes
    }

    package tickets {
        usecase "티켓 구매하기" as PurchaseTickets
        usecase "티켓 환불하기" as RefundTickets
        usecase "티켓 생성하기" as GenerateTickets
    }

    PurchaseTickets ..> PaymentGateway
    RefundTickets ..> PaymentGateway
    CreateShowtimes ..> GenerateTickets

}

administrator --> mbs
@enduml
{% endplantuml %}

실제 프로젝트라면 이것보다 더 많은 유스케이스가 있겠지만, 여기서는 단순화했다. 그럼에도 불구하고 중요한 개념들이 상당수 드러난다.

여기서 주목할 것은 상영 시간을 생성하면 티켓도 같이 생성해야 한다는 점이다. 그리고 티켓을 구매하거나 환불할 때 `Payment Gateway`와 상호작용이 필요함을 언급했다.

점선 두 개를 기억해 두자. 이 다이어그램에서 가장 값진 정보다. `CreateShowtimes ..> GenerateTickets`는 상영시간 생성이 티켓 생성을 끌고 들어간다는 뜻인데, 이 점선 하나가 연재 후반부의 주인공이 된다. 실물에서 이 유스케이스는 시드 전체에서 가장 복잡한 모듈인 [showtime-creation](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/showtime-creation/showtime-creation.service.ts)이 됐고, 비동기 작업과 보상 처리까지 갖추게 된다. `PurchaseTickets ..> PaymentGateway`도 같은 무늬다. 외부 시스템에 걸친 작업은 중간에 실패했을 때 되돌릴 방법이 필요하다. 분석 단계의 점선은 "여기가 나중에 어려워진다"는 예고편이다.

### 5.3. 전체 유스케이스

`customer`와 `administrator`의 유스케이스를 합쳐보자.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle "Payment Gateway" as PaymentGateway

package "Movie Booking System" as mbs {
package theaters {
usecase "극장 추가하기" as AddTheaters
}

    package movies {
        usecase "영화 추가하기" as AddMovies
        usecase "영화 상세보기" as MovieDetails
        usecase "영화 검색하기" as SearchMovies
    }

    package customers {
        usecase "고객 검색하기" as SearchCustomers
    }

    package showtimes {
        usecase "상영 시간 생성하기" as CreateShowtimes
    }

    package tickets {
        usecase "티켓 구매하기" as PurchaseTickets
        usecase "티켓 환불하기" as RefundTickets
        usecase "티켓 생성하기" as GenerateTickets
    }

}

administrator --> AddTheaters
administrator --> AddMovies
administrator --> SearchCustomers
administrator --> CreateShowtimes
administrator --> PurchaseTickets
administrator --> RefundTickets

customer --> MovieDetails
customer --> SearchMovies
customer --> PurchaseTickets
customer --> RefundTickets

PurchaseTickets ..> PaymentGateway
RefundTickets ..> PaymentGateway
CreateShowtimes ..> GenerateTickets

@enduml
{% endplantuml %}

이렇게 전체 유스케이스를 놓고 보니 뭔가 허전하다. `AddTheaters`는 있는데 `SearchTheaters` 같은 건 보이지 않는다. `customers`도 마찬가지다. `RegisterCustomer`나 `LoginCustomer`도 필요하지 않을까?

생략된 유스케이스는 대개 당연히 있어야 할 것들이다. 도메인 전문가 입장에서는 설명할 것이 많기 때문에 이렇게 당연한 유스케이스는 생략하려 할 것이다. 그렇다면 개발자 입장에서는 어떨까? `SearchTheaters` 같은 단순한 유스케이스는 생략하는 편이 문서관리에 더 도움이 되지 않을까?

이 글은 주로 백엔드 설계에 초점을 맞추고 있어서 `SearchTheaters` 같은 단순한 유스케이스는 생략해도 괜찮을 것이다. 하지만 실제 프로젝트라면 이런 유스케이스도 모두 중요하다. 특히 기획자 입장에서 이런 유스케이스는 좋은 출발점이 되기 때문이다. 이제 기획자는 극장을 어떤 조건으로 어떻게 검색할 수 있게 해줘야 할지 고민할 수 있을 것이다.

> 이렇게 모든 유스케이스를 합치면 복잡해진다. 실제 프로젝트라면 훨씬 더 복잡했을 것이다. 이런 경우 무리하게 합칠 필요는 없다. 여기서는 누락된 유스케이스가 있다는 것을 보여주려고 합쳐본 것이다.

누락된 유스케이스를 모두 채워보자. 편의상 액터와 유스케이스 관계는 일부 생략한다.

{% plantuml %}
@startuml
left to right direction
actor customer
actor administrator
rectangle "Payment Gateway" as PaymentGateway

package "Movie Booking System" as mbs {
package theaters {
usecase "극장 추가하기" as AddTheaters
usecase "극장 검색하기" as SearchTheaters
}

    package movies {
        usecase "영화 추가하기" as AddMovies
        usecase "영화 상세보기" as MovieDetails
        usecase "영화 검색하기" as SearchMovies
    }

    package customers {
        usecase "고객 검색하기" as SearchCustomers
        usecase "고객 등록하기" as RegisterCustomer
        usecase "고객 로그인" as LoginCustomer

    }

    package showtimes {
        usecase "상영 시간 생성하기" as CreateShowtimes
        usecase "상영 시간 검색하기" as SearchShowtimes
    }

    package tickets {
        usecase "티켓 구매하기" as PurchaseTickets
        usecase "티켓 환불하기" as RefundTickets
        usecase "티켓 생성하기" as GenerateTickets
        usecase "티켓 검색하기" as SearchTickets
    }

}

administrator --> AddTheaters
administrator --> AddMovies
administrator --> SearchCustomers
administrator --> CreateShowtimes

customer --> RegisterCustomer
customer --> LoginCustomer

PurchaseTickets ..> PaymentGateway
RefundTickets ..> PaymentGateway
CreateShowtimes ..> GenerateTickets

@enduml
{% endplantuml %}

### 5.4. 유스케이스는 어디로 갔나

분석은 여기까지다. 그런데 이 연재에는 실물이 있으니, 이 다이어그램의 유스케이스들이 어떤 코드로 착지했는지 바로 대조해 볼 수 있다. 계층 구조와 배치 기준은 다음 편들의 주제이므로 여기서는 목적지만 확인한다.

| 분석 단계의 유스케이스                | 실물                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 고객 등록하기 · 고객 로그인           | [users.http-controller.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway/users.http-controller.ts)가 `UsersService`를 바로 호출한다                       |
| 고객 검색하기                         | 같은 컨트롤러의 admin 전용 조회                                                                                                                                                             |
| 영화 추가·검색·상세보기               | [movies.http-controller.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway/movies.http-controller.ts) → `MoviesService`                                    |
| 극장 추가·검색하기                    | [theaters.http-controller.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway/theaters.http-controller.ts) → `TheatersService`                              |
| 상영 시간 생성하기 + 티켓 생성하기    | [ShowtimeCreationService](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/showtime-creation/showtime-creation.service.ts) — 두 유스케이스가 한 모듈이다 |
| 상영 시간 선택 · 좌석 선택(예매 동선) | [BookingService](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/booking/booking.service.ts)                                                            |
| 티켓 구매하기                         | [PurchaseService](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/purchase/purchase.service.ts)                                                         |
| admin 계정 만들기(root)               | [admins.http-controller.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway/admins.http-controller.ts) → `AdminsService`                                    |

대조표에서 세 가지가 눈에 띈다.

첫째, 분석 때 `customers`라고 부르던 묶음이 실물에서는 `users`다. 코드를 열어 보면 이 도메인의 알맹이는 고객 정보가 아니라 계정과 인증이다. 가입, 로그인, 토큰 재발급, 탈퇴가 코드의 대부분을 차지한다. 이름은 분석 단계에서 한 번 정하고 끝나는 것이 아니라, 코드가 실제로 하는 일에 맞춰 다시 다듬어진다.

둘째, `티켓 환불하기`는 실물에 없다. nest-seed는 패턴마다 본보기 하나를 두는 시드라서, 구매와 같은 무늬(외부 결제 연동, 실패 시 되돌리기)인 환불은 구현을 생략했다. 대신 그 무늬 자체는 남아 있다. 구매 도중 티켓 확보가 실패하면 이미 만든 결제를 취소하는 보상 경로가 `PurchaseService` 안에 있는데, 환불을 구현한다면 바로 이 코드가 출발점이 된다.

셋째, 분석에 없던 유스케이스도 생겼다. 사용자의 관람 기록을 바탕으로 영화를 추천하는 [recommendation](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/recommendation/)이다. 유스케이스 목록은 분석 단계에서 확정되는 것이 아니라 프로젝트가 사는 동안 계속 자란다. 그러니 다이어그램을 완벽하게 만들려고 붙들고 있을 필요가 없다. 지금 아는 것을 정리했으면 다음 단계로 가면 된다.

### 5.5. 유스케이스가 많다면

지금은 작은 프로젝트이기 때문에 괜찮지만 프로젝트가 크고 복잡하다면 도메인 전문가는 어디부터 설명을 해야 할지 난감해할 수도 있다.
이럴 땐 액터가 충분했는지 다시 점검해보자. 초기에 `administrator`라고 했지만 역할에 따라 세분화할 수 있을지도 모른다. 그리고 `Movie Booking System`을 사용하는 외부 서비스가 있을지도 모른다.

{% plantuml %}
@startuml
left to right direction
actor customer
actor "Call Center Agent" as admin1
actor "Ticket Checker" as admin2
actor "Movie Statistics Service" as service
actor administrator as admin

package "Movie Booking System" as mbs {
usecase " "
}

customer --> mbs
admin1 --> mbs
admin2 --> mbs
service --> mbs
admin ..> admin1
admin ..> admin2
@enduml
{% endplantuml %}

이렇게 액터를 세분화한다면 도메인 전문가는 보다 체계적으로 정보를 알려줄 수 있을 것이다.

물론, 이것은 복잡한 도메인을 분석하는 한 예일 뿐이다. 다른 좋은 방법이 얼마든지 있을 것이다. 참고로 시드는 반대 방향의 사례다. 예제 도메인의 규모에서는 user, admin, root 세 역할이면 충분했고, 그 이상 쪼개지 않았다. 액터 세분화는 도메인 전문가의 설명을 체계화하기 위한 수단이지 그 자체가 목표가 아니다.

## 6. 결론

유스케이스 다이어그램을 활용해서 프로젝트의 목표를 설정하고, 초기 분석 단계를 진행해 보았다. 개인적으로 전체 개발 프로세스 중에서 시작이 가장 어렵다고 생각한다. 가장 추상적이고 모호한 개념을 정리해야 하기 때문이다.

보통의 설계 문서는 여기서 "이 유스케이스들이 잘 구현되기를" 바라는 마음으로 끝난다. 이 연재에는 대조표가 있다. 다이어그램의 한글 이름 옆에 붙여 둔 영어 별칭들은 대부분 실물 클래스가 됐고, 접어 넣은 유스케이스는 자기 이름을 얻어 돌아왔고, 분석에 없던 액터와 유스케이스가 운영과 기능 확장에서 추가됐다. 분석이 완벽하지 않아도 괜찮은 이유는, 유스케이스라는 출발점이 이후의 변경을 흡수할 만큼 튼튼하기 때문이다.

다음 글에서는 여기서 도출한 유스케이스 중 `상영 시간 생성하기`를 골라 명세서를 쓰고, 시퀀스 다이어그램으로 펼치고, REST API로 옮긴다. 그 API가 실물의 [showtime-creation.http-controller.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway/showtime-creation.http-controller.ts)와 얼마나 일치하는지, 그리고 어디가 달라졌는지도 함께 본다.
