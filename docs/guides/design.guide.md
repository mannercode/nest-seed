# Design Guide

설계 단계의 규칙을 설명한다.

## 1. 상호 참조

모든 서비스는 단방향 의존 관계를 갖도록 설계해서 상호 참조 문제가 발생하지 않도록 한다.
상호참조가 필요한 경우 그 부분만 별도의 서비스로 만들거나 두 서비스를 하나로 합쳐야 한다.
이 규칙은 서비스, 모듈, 클래스 등 규모에 상관없이 동일하게 적용된다.

### 1.1. Controller의 분리

이 프로젝트의 아키텍쳐는 상호 참조 문제를 피하기 위해서 일반적인 Nest 프로젝트와 다소 다른 부분이 있다.

```plantuml
@startditaa
+---------------------------------------------------+
|                  Controller Module                |
+-------------------+-----------------------+-------+
                    |                       |
                    v                       |
+----------------------------------+        |
|         ServiceC Module          |        |
+------------+-------------------+-+        |
             |                   |          |
             v                   v          v
+--------------------------+------------------------+
|    ServiceA Module       |    ServiceB Module     |
+-=------------------------|-=----------------------+
|  Infrastructure (RepoA)  | Infrastructure (RepoB) |
+--------------------------+------------------------+
@endditaa
```

Nest에서는 일반적으로 Controller, Service, Repository가 같은 모듈에 위치하는 `Feature Module` 구조를 사용한다. 그러나 이 구조는 [순환 참조 문제](./problems-with-feature-modules.md)가 쉽게 발생할 수 있다. 따라서 이 문제를 해결하기 위해 Controller와 Service를 분리하는 구조를 선택했다.

여기서 Controller는 Monolithic에서 MSA의 gateway에 해당하는 기능을 한다.
만약 프로젝트가 MSA라면 Controller는 각 `Feature Module`에 속하는 것이 옳다.

### 1.2. 서비스의 분리

이 프로젝트의 서비스는 크게 Application, Core, Infrastructure로 나눈다

Infrastructure Service의 특징은 다음과 같다.

1. 파일과 같은 시스템의 자원이나 결제 같은 외부 서비스를 사용하기 위한 인터페이스를 가진다.
1. 다른 서비스를 참조하지 않는다.

Core Serivce의 특징은 다음과 같다.

1. 다른 서비스에 존재하지 않는 독립적인 repository를 가진다.
1. Infrastructure 서비스를 제외한 다른 서비스를 참조하지 않는다.

Application Service의 특징은 다음과 같다.

1. repository가 존재하지 않거나 다른 서비스에 존재하는 데이터로 생성 가능한 데이터를 가진다
1. Core와 Infrastructure 서비스를 참조할 수 있다.

```plantuml
@startditaa
+----------------------------------------------+
|             Application Services             |
+----------------+---------------------+-------+
                 |                     |
                 v                     |
+-------------------------------+      |
|         Core Services         |      |
+----------------+--------------+      |
                 |                     |
                 v                     v
+----------------------------------------------+
|         Infrastructure Services              |
+-----------------------+----------------------+
                        |
                        v
+----------------------------------------------+
|          Infrastructure Resources            |
+----------------------------------------------+
@endditaa
```

### 1.3. 서비스의 이름

프로세스 중심 서비스는 단수형으로 명명하는 것이 일반적입니다.

1. AuthenticationService: 사용자 인증 프로세스를 처리합니다.
1. AuthorizationService: 권한 부여 프로세스를 처리합니다.
1. RecommendationService: 컨텐츠를 추천합니다.

엔티티 관리 서비스는 복수형으로 명명하는 것이 일반적입니다.

1. UsersService: 사용자 엔티티를 관리합니다.
1. OrdersService: 주문 엔티티를 관리합니다.
1. ProductsService: 제품 엔티티를 관리합니다.

## 2. REST API

### 2.1. GET과 POST 선택

10,000명의 user정보 조회 요청은 너무 길어서 GET 메소드로 전달할 수 없다.

```sh
GET /users?user-id=userid1, userid2, userid3 ...
```

이렇게 `GET`이나 `DELETE` 메소드인데 쿼리가 너무 길다면 아래처럼 POST로 요청한다.

```sh
# 찾는다
GET /movies?...
# 찾기를 실행한다
POST /movies/find

# 삭제를 한다
DELETE /movies?...
# 삭제를 실행한다
POST /movies/delete
```

POST 메소드는 일반적으로 `Create`를 의미하지만 `함수를 실행한다`는 의미로도 사용한다.

GET과 POST를 선택할 때는 다음의 사항을 고려해야 한다.

-   GET이 적합한 경우
    -   전달할 데이터가 매우 적고 간단한 경우
    -   캐싱이 필요한 경우
    -   북마크 가능성이나 주소창을 통한 URL 공유가 필요한 경우
-   POST가 적합한 경우
    -   전달할 데이터가 많거나 복잡한 경우 (예: 파일, 긴 텍스트 등)
    -   데이터가 민감한 경우 (예: 패스워드, 개인 정보 등)
    -   서버의 상태를 변경하는 동작을 수행하는 경우 (예: 리소스 생성, 수정)

### 2.2. Self Descriptive API 제한

HATEOAS(Hypermedia as the engine of application state)의 완전한 자체 설명을 구현하는 것은 어렵고 복잡하다.
단순 link 정도의 수준으로 제공해야 하며 복잡한 API는 문서로 설명해야 한다.

문서를 완전히 대체하려는 노력보다는 오류 정보를 더 자세히 출력하는 코드를 작성하는 것이 효율적이다.

```json
// 일반적인 HATEOAS의 예
{
    "results": [
        {
            "_expandable": {
                "children": "/rest/api/content/98308/child",
                "history": "/rest/api/content/98308/history"
            },
            "_links": {
                "self": "http://localhost:8080/confluence/rest/api/content/98308",
                "webui": "/pages/viewpage.action?pageId=98308"
            }
        }
    ]
}
```
