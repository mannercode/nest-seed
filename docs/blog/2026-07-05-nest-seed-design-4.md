---
layout: post
title: 백엔드 서비스 분석과 설계 — nest-seed로 증명하기 (4)
lang: ko
---

설계가 끝났다. 유스케이스가 REST API가 됐고, API가 계층에 배치됐고, 오래 걸리는 작업은 202와 사가로 계약이 바뀌었다. 이제 구현이다. 연재의 마지막인 이번 글에서는 무엇부터 구현할지, 그리고 테스트를 어떻게 작성할지를 다룬다. 모든 코드는 [nest-seed](https://github.com/mannercode/nest-seed) 저장소의 실물이다.

## 1. 무엇부터 구현해야 할까?

지금까지 그린 시퀀스 다이어그램은 호출 흐름을 파악하기에는 좋지만 서비스 간의 의존 관계를 파악하기에는 부족함이 있다.

컴포넌트 다이어그램으로 의존 관계와 호출 흐름을 함께 표현해 보자. 상자 하나하나가 저장소의 실물이다. 워크플로와 검증자·생성자 사이에 있는 액티비티 계층(`ShowtimeCreationActivities`)은 접었다.

{% plantuml %}
@startuml
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam shadowing false
top to bottom direction

component "웹브라우저" as User

package "gateway" {
component "ShowtimeCreationHttpController" as GController
}

package "application: showtime-creation" {
component "ShowtimeCreationService" as AService
component "ShowtimeCreationOrchestratorService\n(internal/)" as AOrch
component "showtimeCreationWorkflow\n(worker/, Temporal)" as AWorkflow
component "ShowtimeBulkValidatorService\n(internal/)" as AValidator
component "ShowtimeBulkCreatorService\n(internal/)" as ACreator

AService --> AOrch : <b><color:red> 3. enqueueShowtimeCreationJob</color></b>
AOrch --> AWorkflow : <b><color:red> 4. workflow.start</color></b>
AWorkflow --> AValidator : <b><color:red> 5. validate</color></b>
AWorkflow --> ACreator : <b><color:red> 7. create</color></b>
}

package "core" {
component "ShowtimesService" as CShowtimes
component "TicketsService" as CTickets
}

database "ShowtimesDB" as SDB
database "TicketsDB" as TDB

note left of SDB
movieId
theaterId
startTime
endTime
end note

note right of TDB
showtimeId
movieId
theaterId
status
seat
end note

User --> GController : <b><color:red> 1. POST /showtime-creation/showtimes</color></b>
GController --> AService : <b><color:red> 2. requestShowtimeCreation</color></b>
AValidator --> CShowtimes : <b><color:red> 6. search</color></b>
ACreator --> CShowtimes : <b><color:red> 8. createMany</color></b>
ACreator --> CTickets : <b><color:red> 10. createMany</color></b>
CShowtimes --> SDB : <b><color:red> 9. save</color></b>
CTickets --> TDB : <b><color:red> 11. save</color></b>
@enduml
{% endplantuml %}

3편에서 정한 설계가 그대로 코드가 됐다. 요청은 202와 sagaId로 즉시 접수되고, 검증과 생성은 Temporal 워크플로가 맡고, 검증+삽입은 분산 락 안에서 한 사가씩 처리된다. 모듈 밖에 공개되는 것은 [ShowtimeCreationService](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/showtime-creation/showtime-creation.service.ts)와 SSE 통로인 ShowtimeCreationEvents뿐이고, 조율자·검증자·생성자는 internal/에 숨는다.

크게 11개의 호출이 있다. 이 중에서 제일 먼저 구현해야 하는 것은 무엇일까?

편의를 위해 아래처럼 호출 구조를 단순화해서 설명하겠다. 사가와 조율 계층은 접었다 — 남긴 것은 계층의 깊이다.

{% plantuml %}
@startuml
skinparam componentStyle rectangle
skinparam packageStyle rectangle
skinparam shadowing false
top to bottom direction

component "CreatorService\n--\ncreate(movieId, theaterId, startTime, duration)" as ACreator
component "ValidatorService\n--\nvalidate(theaterId, startTime, duration)" as AValidator

ACreator --> AValidator : validate

component "ShowtimesService\n--\nfind(theaterId, startTime, duration)\nsave(movieId, theaterId, startTime, duration)" as CShowtimes

database "ShowtimesDB" as SDB

ACreator --> CShowtimes : save
AValidator --> CShowtimes : find
CShowtimes --> SDB
@enduml
{% endplantuml %}

### 1.1. bottom-up: DB부터 시작해서 위로 올라간다

많은 개발자들이 처음 구현을 시작할 때 DB 컬렉션부터 만드는 bottom-up 방식을 선호한다. 위 다이어그램으로 예를 들면 showtimes 컬렉션에 movieId, theaterId, startTime, duration 필드를 정의하고 여기에 계속 살을 붙여가는 것이다.

```ts
// Step 1. DB에 가장 가까운 곳부터 시작한다.
class ShowtimesService {
    constructor(private db: MongoDB) {}

    find(theaterId: string, startTime: Date, duration: number) {
        return this.db.find({ theaterId, startTime, duration })
    }
    save(movieId: string, theaterId: string, startTime: Date, duration: number) {
        return this.db.save({ movieId, theaterId, startTime, duration })
    }
}

async function main() {
    const db = await connectMongo('mongodb://localhost:27017')
    const showtimesService = new ShowtimesService(db)

    const saved = await showtimesService.save(
        'movie#1',
        'theater#1',
        new Date('2026-01-01T10:00'),
        120
    )
    console.log('saved:', saved)

    const showtimes = await showtimesService.find('theater#1', new Date('2026-01-01T10:00'), 120)
    console.log('showtimes:', showtimes)
}
main()
```

```ts
// Step 2. 한 단계 위 레이어로 올라간다.
class ValidatorService {
    constructor(private showtimesService: ShowtimesService) {}

    async validate(theaterId: string, startTime: Date, duration: number) {
        const conflicts = await this.showtimesService.find(theaterId, startTime, duration)
        if (conflicts.length > 0) throw new Error('conflict')
    }
}

async function main() {
    // ... Step 1 코드 ...

    const validatorService = new ValidatorService(showtimesService)
    await validatorService.validate('theater#1', new Date('2026-01-01T13:00'), 120)
    console.log('validation passed')
}
main()
```

> 시간이 겹치는 상영시간을 찾으려면 실제로는 구간 겹침 조건의 범위 검색이 필요하다. 실물의 충돌 검사가 정확히 그렇다 — existing.startTime < new.endTime && new.startTime < existing.endTime. 여기서는 설명을 위해 find를 완전 일치 조회로 단순화했다.

```ts
// Step 3. 또 한 단계 위로 올라간다.
class CreatorService {
    constructor(
        private validatorService: ValidatorService,
        private showtimesService: ShowtimesService
    ) {}

    async create(movieId: string, theaterId: string, startTime: Date, duration: number) {
        await this.validatorService.validate(theaterId, startTime, duration)
        await this.showtimesService.save(movieId, theaterId, startTime, duration)
    }
}

async function main() {
    // ... Step 1~2 코드 ...

    const creator = new CreatorService(validatorService, showtimesService)
    await creator.create('movie#1', 'theater#1', new Date('2026-01-01T15:00'), 120)
    console.log('creation done')
}
main()
```

함수를 하나 작성할 때마다 main()에 실행 코드가 추가돼서 길어졌다. 보통은 함수가 완성되면 이런 임시 코드는 삭제하겠지만 여기서는 굳이 남겨놨다.

생각해보면 main()에 작성한 코드는 결국 "이 함수가 잘 동작하는지 확인하는 코드"다. 그렇다면 이걸 함수로 분리하면 어떨까?

```ts
async function test_ShowtimesService_find(showtimesService: ShowtimesService) {
    const showtimes = await showtimesService.find('theater#1', new Date('2026-01-01T10:00'), 120)
    console.log('showtimes:', showtimes)
}

async function test_ShowtimesService_save(showtimesService: ShowtimesService) {
    const saved = await showtimesService.save(
        'movie#1',
        'theater#1',
        new Date('2026-01-01T10:00'),
        120
    )
    console.log('saved:', saved)
}

async function test_ValidatorService_validate(validatorService: ValidatorService) {
    await validatorService.validate('theater#1', new Date('2026-01-01T13:00'), 120)
    console.log('validation passed')
}

async function test_CreatorService_create(creator: CreatorService) {
    await creator.create('movie#1', 'theater#1', new Date('2026-01-01T15:00'), 120)
    console.log('creation done')
}

async function main() {
    const db = await connectMongo('mongodb://localhost:27017')
    const showtimesService = new ShowtimesService(db)
    const validatorService = new ValidatorService(showtimesService)
    const creator = new CreatorService(validatorService, showtimesService)

    await test_ShowtimesService_find(showtimesService)
    await test_ShowtimesService_save(showtimesService)
    await test_ValidatorService_validate(validatorService)
    await test_CreatorService_create(creator)
}
main()
```

main()에서 임시로 작성했던 코드가 그대로 테스트 코드가 된다. 이것을 Jest로 잘 정리하면 훌륭한 유닛 테스트가 될 것 같다.

함수마다 테스트가 있으니 제대로 동작할 거라고 안심하게 된다. 실제로 이 방식에는 장점이 있어 보인다. test_ValidatorService_validate가 실패하면 ValidatorService에 문제가 있다는 뜻이니까, 실패 지점을 바로 알 수 있을 것 같다.

### 1.2. bottom-up의 함정: 함수마다 작성한 테스트

그러면 이번에는 요구사항이 변경되어 duration 대신 endTime을 받게 되었다고 하자. 상위 인터페이스의 변경은 아래로 전파된다.

```ts
class CreatorService {
    constructor(
        private validatorService: ValidatorService,
        private showtimesService: ShowtimesService
    ) {}

    async create(movieId: string, theaterId: string, startTime: Date, endTime: Date) {
        await this.validatorService.validate(theaterId, startTime, endTime)
        await this.showtimesService.save(movieId, theaterId, startTime, endTime)
    }
}

class ValidatorService {
    constructor(private showtimesService: ShowtimesService) {}

    async validate(theaterId: string, startTime: Date, endTime: Date) {
        const conflicts = await this.showtimesService.find(theaterId, startTime, endTime)
        if (conflicts.length > 0) throw new Error('conflict')
    }
}

class ShowtimesService {
    constructor(private db: MongoDB) {}

    find(theaterId: string, startTime: Date, endTime: Date) {
        return this.db.find({ theaterId, startTime, endTime })
    }
    save(movieId: string, theaterId: string, startTime: Date, endTime: Date) {
        return this.db.save({ movieId, theaterId, startTime, endTime })
    }
}
```

duration이 endTime으로 바뀌면서 4개 함수가 모두 수정됐다. 그러면 테스트 코드는?

```ts
// ❌ duration으로 조회했다
async function test_ShowtimesService_find(showtimesService: ShowtimesService) {
    const showtimes = await showtimesService.find('theater#1', new Date('2026-01-01T10:00'), 120)
}

// ❌ duration으로 저장했다
async function test_ShowtimesService_save(showtimesService: ShowtimesService) {
    const saved = await showtimesService.save(
        'movie#1',
        'theater#1',
        new Date('2026-01-01T10:00'),
        120
    )
}

// ❌ duration으로 검증했다
async function test_ValidatorService_validate(validatorService: ValidatorService) {
    await validatorService.validate('theater#1', new Date('2026-01-01T13:00'), 120)
}

// ❌ duration으로 생성했다
async function test_CreatorService_create(creator: CreatorService) {
    await creator.create('movie#1', 'theater#1', new Date('2026-01-01T15:00'), 120)
}
```

4개의 테스트가 모두 컴파일 에러로 깨진다. 코드는 정상적으로 수정됐지만 테스트만 옛날 인터페이스를 호출하고 있기 때문이다.

이 변경은 가상의 예가 아니다. nest-seed의 Showtime 엔티티가 정확히 이 길을 걸었다. 요청 DTO인 [BulkCreateShowtimesDto](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/showtime-creation/dtos/bulk-create-showtimes.dto.ts)는 관리자 입력에 자연스러운 durationInMinutes를 받지만, 엔티티는 [startTime과 endTime](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/core/showtimes/models/showtime.ts)을 저장한다. 구간 겹침 검사와 범위 검색에는 끝 시각이 있어야 하기 때문이다. duration에서 endTime으로 넘어가는 변환이 어느 계층에 놓이는지는 개발 중에 몇 번이고 옮겨질 수 있다. 함수마다 테스트를 붙여놨다면 옮길 때마다 테스트가 깨졌을 것이다.

함수마다 테스트를 작성하면 하나의 요구사항 변경이 여러 함수의 인터페이스를 연쇄적으로 바꾸고, 그에 딸린 테스트까지 모두 수정해야 한다. 테스트가 기능을 검증하는 게 아니라 인터페이스 변경을 따라다니는 짐이 되는 것이다. 이 경험이 몇 번 반복되면 테스트를 유지하는 비용이 테스트의 이점을 넘어서고 결국 테스트를 포기하게 된다.

여기서 혼란에 빠지게 된다. "테스트가 실패하면 실패 지점을 바로 알 수 있어야 한다"고 했으니까 함수마다 테스트를 작성하는 게 옳은 것 같다. 그런데 이렇게 하면 작은 인터페이스 변화에도 많은 테스트가 깨진다. 그렇다면 TDD 자체가 비현실적인 방법론이 아닌가?

이 혼란의 원인은 unit test의 "unit"을 함수 단위로 해석하는 데 있다. unit은 함수가 아니라 **하나의 동작(behavior)**이다. bottom-up 개발에서 함수를 작성할 때마다 만든 임시 실행 코드를 테스트로 남기면 자연스럽게 이 함정에 빠지게 된다. 이에 대해서는 뒤에서 더 자세히 다룬다.

bottom-up에는 또 다른 문제도 있다. 실행과 검증이 어렵다는 점이다. 컬렉션을 만들었으면 데이터를 넣고 읽어봐야 하는데, 그러려면 코드를 작성해야 하고, 그 코드를 실행하려면 또 임시 코드가 필요하다. 앞서 본 main() 함수가 바로 그 임시 코드다.

### 1.3. top-down: REST API부터 시작해서 아래로 내려간다

왜 많은 개발자들이 bottom-up 방식을 선택할까? 가장 큰 이유는 설계의 부재일 것이다.

도메인 전문가의 머릿속에 있는 추상적인 생각을 구체화하는 것은 어려운 일이다. "상영시간을 관리하고 싶다"는 생각은 있지만 "어떤 데이터가 필요하고, 어떤 흐름으로 동작해야 하는지"는 대화를 통해 끌어내야 한다. 이 과정이 어렵기 때문에 개발자는 자연스럽게 가장 구체적인 것, 즉 형태가 명확한 DB부터 만들고 거기에 기능을 붙여나가게 된다. 그 결과 요구사항을 구현하는 것이 아니라, 구현에 요구사항을 맞추게 된다.

다행히 우리는 지금까지 top-down 방식으로 요구사항을 분석하고 설계했다. 유스케이스에서 출발해 REST API라는 구체적인 계약이 이미 손에 있다.

{% plantuml %}
@startuml
Frontend -> Backend: 영화 목록 요청\nGET /showtime-creation/movies
Frontend <-- Backend: movies[]

    Frontend -> Backend: 극장 목록 요청\nGET /showtime-creation/theaters
    Frontend <-- Backend: theaters[]

    Frontend -> Backend: 기존 상영시간 조회\nPOST /showtime-creation/showtimes/search
    Frontend <-- Backend: showtimes[]

    Frontend -> Backend: 상영시간 생성 요청\nPOST /showtime-creation/showtimes
    Frontend <-- Backend: 202 { sagaId }

@enduml
{% endplantuml %}

top-down은 이 계약의 맨 위, 즉 REST API에서 시작한다.

```ts
// Step 1. 가장 위에서 시작한다. 내부는 아직 스텁이다.
@Injectable()
class ShowtimeCreationService {
    async requestShowtimeCreation(createDto: BulkCreateShowtimesDto) {
        // TODO: validate + create
        return { sagaId: '000000000000000000000001' }
    }
}

@Controller('showtime-creation')
class ShowtimeCreationHttpController {
    constructor(private readonly showtimeCreationService: ShowtimeCreationService) {}

    @HttpCode(HttpStatus.ACCEPTED)
    @Post('showtimes')
    async requestShowtimeCreation(@Body() createDto: BulkCreateShowtimesDto) {
        return this.showtimeCreationService.requestShowtimeCreation(createDto)
    }
}
```

컨트롤러의 모양은 실물([showtime-creation.http-controller.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/gateway/showtime-creation.http-controller.ts))과 이미 같다. 스텁이지만 실행이 된다.

```sh
curl -sX POST localhost:3000/showtime-creation/showtimes \
  -H 'Content-Type: application/json' \
  -d '{"movieId":"...","theaterIds":["..."],"durationInMinutes":120,"startTimes":["2026-01-01T10:00:00.000Z"]}'
```

```json
{ "sagaId": "000000000000000000000001" }
```

이제 한 계층씩 아래로 내려가면서 스텁을 진짜 구현으로 바꾼다. 조율자를 만들고, 워크플로를 만들고, 검증자와 생성자를 만들고, Core 서비스와 리포지토리를 만든다. 그동안 실행 방법은 한 번도 바뀌지 않는다. 위의 curl 명령 그대로다. 계약이 그대로니까.

물론 durationInMinutes가 endTime으로 바뀌는 것처럼 REST API의 계약 자체가 변경되면 curl도 수정해야 한다. 그러나 수정 지점은 curl 명령 1곳뿐이다. bottom-up에서 4개 함수의 테스트를 모두 고쳐야 했던 것과는 비용이 다르다.

## 2. 테스트는 어떻게 작성해야 할까?

### 2.1. unit은 함수가 아니라 동작이다

앞서 bottom-up의 함정에서 unit test의 "unit"을 함수 단위로 해석하면 문제가 생긴다고 했다.

사용자가 "상영시간을 생성해줘"라고 요청하면, 내부적으로 검증 → 상영시간 저장 → 티켓 저장이 순서대로 실행된다. 사용자 입장에서 이건 하나의 동작이다. 이 동작 전체가 하나의 unit이지, find, save, validate 각각이 unit이 아니다.

테스트도 "상영시간 생성을 요청하면 sagaId가 돌아온다", "충돌이 있으면 충돌 목록이 돌아온다"처럼 동작 단위로 작성해야 한다. 그래야 내부 함수의 인터페이스가 바뀌어도 동작이 같으면 테스트는 깨지지 않는다. 3편의 1차 스케치(큐)가 최종적으로 Temporal 워크플로가 되었어도, 동작 단위의 문장 — 사가 식별자를 반환한다, 상영 시간을 생성한다 — 은 바뀔 이유가 없다. 202와 sagaId라는 계약이 그대로이기 때문이다.

top-down에서는 이것이 자연스럽다. 개발하면서 실행한 curl 명령들을 모아놓으면 그 자체가 동작 단위의 테스트 코드가 된다.

### 2.2. spec이 테스트 코드이자 API 문서가 된다

많은 개발자들이 Swagger나 Postman을 사용하지만 나는 curl 기반의 쉘 스크립트를 선호한다. 환경을 가리지 않고 어디서든 실행할 수 있고, 테스트 코드이자 동작하는 API 문서가 되기 때문이다.

nest-seed에서 이 스크립트는 [apps/api/api-docs/](https://github.com/mannercode/nest-seed/blob/main/apps/api/api-docs)의 `*.spec` 파일들이다. 상영시간 생성의 spec 전문을 보자([showtime-creation.spec](https://github.com/mannercode/nest-seed/blob/main/apps/api/api-docs/showtime-creation.spec)).

```sh
#!/bin/bash
. ./common.fixture

login_admin
create_movie
publish_movie
create_theater

SHOWTIME_START_TIME=$(date -u -d '+1 day' '+%Y-%m-%dT%H:%M:%S.000Z')

TEST "상영 생성에 사용할 영화 목록을 조회한다" \
	200 GET /showtime-creation/movies

TEST "상영 생성에 사용할 극장 목록을 조회한다" \
	200 GET /showtime-creation/theaters

TEST "상영 시간 대량 생성을 요청한다" \
	202 POST /showtime-creation/showtimes \
	-H 'Content-Type: application/json' \
	-d '{
			"movieId": "'${MOVIE_ID}'",
			"theaterIds": ["'${THEATER_ID}'"],
			"durationInMinutes": 120,
			"startTimes": ["'${SHOWTIME_START_TIME}'"]
		}'

wait_for_showtime

TEST "극장별 상영 시간을 검색한다" \
	200 POST /showtime-creation/showtimes/search \
	-H 'Content-Type: application/json' \
	-d '{ "theaterIds": ["'${THEATER_ID}'"] }'
```

파일 하나가 세 가지 역할을 동시에 한다.

첫째, 테스트다. `TEST`는 [run.sh](https://github.com/mannercode/nest-seed/blob/main/apps/api/api-docs/run.sh)가 정의한 함수로, 설명·기대 상태 코드·HTTP 메서드·경로를 받아 curl을 실행하고 실제 상태 코드를 기대값과 비교한다. 하나라도 어긋나면 실행이 실패로 끝난다.

둘째, 문서다. 실행하면 `_output/docs/summary.md`에 설명·메서드·경로·기대/실제 상태가 표로 정리되고, `_output/logs/`에는 실제로 실행된 curl 명령과 응답 본문이 spec별로 남는다. 손으로 관리하는 API 문서는 코드와 어긋나기 마련인데, 이 문서는 실행이 곧 갱신이라 어긋날 수가 없다.

셋째, 시나리오다. `login_admin`, `create_movie`, `create_theater`는 [common.fixture](https://github.com/mannercode/nest-seed/blob/main/apps/api/api-docs/common.fixture)의 준비 함수다. 내부에서 `SETUP`이라는 또 다른 DSL을 쓰는데, `TEST`와 달리 기대 상태 없이 요청만 보내고 실패하면 실행을 중단한다. 그리고 API 목록에는 남지 않는다 — 문서는 검증 대상인 `TEST`만 담는다.

눈여겨볼 것은 202를 받은 뒤의 `wait_for_showtime`이다. 상영시간 생성은 접수만 하고 비동기로 처리되므로, 다음 검색 TEST가 의미를 가지려면 사가가 끝날 때까지 기다려야 한다. 3편에서 정한 비동기 계약이 문서에도 그대로 드러나는 것이다. 프론트엔드 개발자는 이 spec을 읽는 것만으로 "생성 요청은 202로 접수되고, 결과는 나중에 조회해야 한다"는 사정을 알 수 있다.

실행은 명령 하나다. dev 서버를 띄운 상태에서:

```sh
bash apps/api/api-docs/run.sh showtime-creation.spec
```

그리고 이 spec은 e2e 테스트로도 그대로 쓰인다. [deploy/verify.sh](https://github.com/mannercode/nest-seed/blob/main/deploy/verify.sh)는 배포용 컨테이너를 통째로 세우고 nginx를 거쳐 전체 spec을 실행한다. 프론트엔드나 외부 서비스가 호출하는 것과 거의 동일한 경로다.

앞서 스텁으로 202를 반환하게 만들었던 것을 기억하자. 이 spec을 스텁 상태에서 실행하면 생성 요청 TEST까지는 통과하고 `wait_for_showtime`에서 멈춘다. 상영시간이 실제로 만들어지지 않으니까. 그 실패 지점이 곧 남은 작업 목록이다. 스텁이 spec을 통과하도록 한 계층씩 구현을 채워 내려간다 — 테스트를 먼저 작성하고 그 테스트가 통과하도록 구현하는 것. 의식하지 않아도 자연스럽게 TDD가 된다.

다만 spec에는 주로 성공 흐름을 담는다. 쉘 스크립트는 동작하는 문서 수준으로 유지하고, 실패 흐름과 조건 분기 검증은 테스트 프레임워크가 맡는 게 효율적이다.

### 2.3. 조건과 실패 분기는 Jest 통합 테스트가 맡는다

상영시간 생성에는 성공 말고도 검증해야 할 흐름이 많다. 시간이 겹치면? 영화가 없으면? 티켓을 만들다 실패하면? 이런 분기는 [showtime-creation.spec.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/__tests__/integration/application/showtime-creation.spec.ts)의 Jest 통합 테스트가 맡는다. 네 토막으로 발췌한다. 전부 실물이고, 설명에 필요한 부분만 남겼다.

**준비.** mock 서버가 아니라 실제 앱을 세운다.

```ts
describe('ShowtimeCreationService', () => {
    let fix: AppTestContext
    let showtimesService: ShowtimesService
    let ticketsService: TicketsService
    let movie: MovieDto
    let theater: TheaterDto

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        const { ShowtimesService, TicketsService } = await import('core')
        const { AdminAuthGuard } = await import('gateway')
        fix = await createAppTestContext({ ignoreGuards: [AdminAuthGuard] })
        showtimesService = fix.module.get(ShowtimesService)
        ticketsService = fix.module.get(TicketsService)

        movie = await createMovie(fix)
        theater = await createTheater(fix)
    })
    afterEach(() => fix.teardown())
```

createAppTestContext는 NestJS 앱을 통째로 만들어 devcontainer가 띄워 둔 실제 MongoDB Replica Set, Redis Cluster, NATS, Temporal에 붙인다. createMovie와 createTheater는 실제 DB에 픽스처를 만든다. 끄는 것은 관리자 인가 가드 하나뿐이다 — 이 스위트의 관심사는 사가이지 인가가 아니고, 인증·인가는 전용 스위트가 따로 검증한다. 클래스들을 beforeEach 안에서 동적으로 가져오는 것은 Jest 설정(`resetModules: true`)이 테스트마다 모듈 레지스트리를 초기화하기 때문이다. 운영 코드와 같은 모듈 그래프에서 가져와야 DI로 꺼낸 인스턴스와 spy 대상이 어긋나지 않는다.

**정상 흐름.** 3편에서 바뀐 계약 — 202 + sagaId + SSE — 이 그대로 테스트 문장이 된다.

```ts
    describe('POST /showtime-creation/showtimes', () => {
        describe('정상 요청 흐름', () => {
            let createPromise: Promise<Response>

            beforeEach(async () => {
                createPromise = fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .body({
                        durationInMinutes: 1,
                        movieId: movie.id,
                        startTimes: [new Date('2100-01-01T09:00')],
                        theaterIds: [theater.id]
                    })
                    .accepted()
            })

            it('사가 식별자를 반환한다', async () => {
                const { body } = await createPromise
                expect(body).toEqual(expect.objectContaining({ sagaId: expect.any(String) }))
            })

            it('상영 시간을 생성한다', async () => {
                const { body } = await createPromise
                const { createdShowtimeCount } = await waitForCompletion(fix, 'succeeded')

                const createdShowtimes = await showtimesService.search({ sagaIds: [body.sagaId] })
                expect(createdShowtimes).toHaveLength(createdShowtimeCount)
            })

            it('티켓을 생성한다', async () => {
                const { body } = await createPromise
                const { createdTicketCount } = await waitForCompletion(fix, 'succeeded')

                const createdTickets = await ticketsService.search({ sagaIds: [body.sagaId] })
                expect(createdTickets).toHaveLength(createdTicketCount)
            })
        })
```

describe와 it이 함수 이름이 아니라 동작과 조건을 말하고 있다. 내부에서 검증·생성이 어떻게 쪼개지든 이 문장들은 그대로 유효하다. [waitForCompletion](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/__tests__/integration/application/showtime-creation.utils.ts)은 SSE 스트림을 구독해 지정한 종결 상태가 올 때까지 기다리는 이 스위트의 유틸이다. 그리고 단언을 보라. 서비스가 보고한 값을 믿지 않고 sagaId로 실제 DB를 재조회해서 끝 상태를 센다. 내부 함수를 호출했는지 검사하는 테스트는 하나도 없다. 이 테스트가 성공하려면 202 접수 → Temporal 워크플로 → 검증·생성 → NATS → SSE로 이어지는 사가 전체가 실제로 돌아야 한다.

**실패 흐름(failed).** 검증 충돌은 400이 아니다. 요청 자체는 접수(202)되고, 충돌 목록은 SSE로 온다.

```ts
it('기존 상영 시간과 겹치면 충돌 목록과 함께 실패 상태를 전송한다', async () => {
    const initialShowtimes = await createShowtimes(
        fix,
        [
            new Date('2013-01-31T12:00'),
            new Date('2013-01-31T14:00'),
            new Date('2013-01-31T16:30'),
            new Date('2013-01-31T18:30')
        ].map((startTime) => ({
            endTime: DateUtil.add({ base: startTime, minutes: 90 }),
            startTime,
            theaterId: theater.id
        }))
    )

    const completionPromise = waitForCompletion(fix, 'failed')

    await fix.httpClient
        .post('/showtime-creation/showtimes')
        .body({
            durationInMinutes: 30,
            movieId: movie.id,
            startTimes: [
                new Date('2013-01-31T12:00'),
                new Date('2013-01-31T16:00'),
                new Date('2013-01-31T20:00')
            ],
            theaterIds: [theater.id]
        })
        .accepted()

    // 새 12:00-12:30은 기존 12:00-13:30과 시간이 겹치므로 충돌이다.
    // 새 16:00-16:30과 기존 16:30-18:00, 새 20:00-20:30과 기존 18:30-20:00은 한 상영이 끝나는 시각에 다른 상영이 시작한다.
    // 끝 시각을 포함하지 않는 정책이라 충돌로 보지 않는다.
    const conflictingShowtimes = [initialShowtimes[0]]

    await expect(completionPromise).resolves.toEqual({
        conflictingShowtimes,
        sagaId: expect.any(String),
        status: 'failed'
    })
})
```

시작 시각 세 개 중 무엇이 충돌이고 무엇이 아닌지, 끝 시각을 포함하지 않는다는 경계 정책까지 테스트가 문서화한다. 이 파일에는 이런 조건 분기가 케이스별로 쌓여 있다 — 영화가 없을 때, 극장이 없을 때, 요청 안에서 시각이 서로 겹칠 때. 그중 하나는 3편의 알고리즘 교체를 회귀 테스트로 고정한 것이다.

```ts
        it('시작 분이 10분 단위로 정렬되지 않은 새 상영도 겹치면 충돌로 보고한다', async () => {
            // 기존 10:00-12:00과 새 10:05-11:05는 55분이 겹친다.
            // 슬롯 격자로 비교하면 시작 분이 다를 때 키 교집합이 비어 충돌을 놓친다.
```

10분 단위 슬롯 격자 방식은 시작 분이 어긋난 상영의 충돌을 놓친다. 그래서 실물은 구간 겹침 비교를 쓴다 — 그리고 그 이유가 이 테스트 한 줄에 박제되어 있다. 나중에 누군가 "Set이 더 빠르지 않나요?"라며 슬롯 격자로 되돌리면 이 테스트가 막는다.

**보상 경로(error).** 3편의 불변식 — 보상을 끝낸 뒤에만 error를 발행한다 — 은 문서 속 문장이 아니라 테스트가 지키는 계약이다.

```ts
describe('생성 도중 티켓 생성이 실패하면', () => {
    let sagaId: string

    beforeEach(async () => {
        // 첫 티켓 묶음은 실제로 적재하고, 그 적재가 끝난 뒤 다음 묶음에서 실패시킨다.
        // 일부 티켓이 DB에 남은 상태로 보상이 돌게 해야 '티켓 삭제' 단언이 헛돌지 않는다.
        const realCreateMany = ticketsService.createMany.bind(ticketsService)
        let firstBatch: ReturnType<typeof realCreateMany> | undefined
        jest.spyOn(ticketsService, 'createMany').mockImplementation(async (createDtos) => {
            if (!firstBatch) {
                firstBatch = realCreateMany(createDtos)
                return firstBatch
            }
            // 첫 묶음이 커밋된 뒤에 던져, 보상 시점에 지울 티켓이 반드시 존재하게 한다.
            await firstBatch
            throw new Error('ticket creation failed')
        })

        const completionPromise = waitForCompletion(fix, 'error')
        const { body } = await fix.httpClient
            .post('/showtime-creation/showtimes')
            .body({
                durationInMinutes: 1,
                movieId: movie.id,
                startTimes: [new Date('2100-01-01T09:00'), new Date('2100-01-01T11:00')],
                theaterIds: [theater.id]
            })
            .accepted()
        sagaId = body.sagaId
        await completionPromise
    })

    it('보상으로 생성된 상영 시간을 모두 삭제한다', async () => {
        const showtimes = await showtimesService.search({ sagaIds: [sagaId] })
        expect(showtimes).toEqual([])
    })

    it('보상으로 생성된 티켓을 모두 삭제한다', async () => {
        const tickets = await ticketsService.search({ sagaIds: [sagaId] })
        expect(tickets).toEqual([])
    })
})
```

티켓 생성 실패는 현실에서 임의로 일으킬 수 없다. 그래서 여기서만 spy로 실패를 주입한다. 그것도 그냥 던지는 게 아니다 — 첫 묶음은 실제 DB에 커밋된 뒤에 터뜨린다. 지울 것이 없는 상태에서 "삭제됐다"를 단언하면 테스트가 헛돌기 때문이다.

그리고 단언 시점을 보라. beforeEach가 error 이벤트를 받은 직후에 it이 DB를 조회해 비어 있음을 단언한다. 만약 워크플로가 보상을 끝내기 전에 error를 발행하면, 그 시점의 DB에는 상영시간과 티켓이 남아 있으므로 이 테스트가 실패한다. "보상을 끝낸 뒤에만 error를 발행한다"는 불변식이 테스트로 고정되어 있는 것이다. 실물 [workflow.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/services/application/showtime-creation/worker/workflow.ts)의 catch 블록 주석도 같은 말을 한다 — "정리를 마친 뒤에 종료를 알린다".

### 2.4. mock은 실패 주입과 관찰에만 쓴다

Jest는 성검이 아니라 마검이다. 정확히는 성검으로 태어났으나 우리가 마검으로 바꾸는 것이다. Jest가 제공하는 다양한 기능을 모두 사용하려는 경향이 있고, 테스트 관련 서적이나 글에서 다루는 온갖 기법을 그대로 적용하면서 오버엔지니어링이 되기 쉽다.

특히 빠지기 쉬운 함정이 mock이다. DB를 mock하고, 메시지 브로커를 mock하고, 이웃 서비스를 mock 서버로 대체하다 보면 테스트는 "mock이 mock을 검증하는" 놀이가 된다. mock은 공짜가 아니다. 구현하고 유지하는 데 비용이 들고, 인터페이스가 바뀌면 mock도 모두 바꿔야 한다. 무엇보다 인덱스, 트랜잭션, 레이스 컨디션처럼 정말 잡아야 하는 문제는 mock이 아니라 실물에서만 드러난다.

그래서 nest-seed의 통합 테스트는 인프라를 mock하지 않는다. devcontainer가 띄운 실제 MongoDB Replica Set, Redis Cluster, MinIO, NATS, Temporal 위에서 돈다. 위에서 본 테스트들이 사가 전체를 실물로 돌릴 수 있었던 이유다.

그럼 spy와 mock은 언제 쓰는가? 실물로는 만들 수 없는 조건을 만들 때다. 저장소의 실제 용례가 전부 이 무늬다.

```ts
// 저장 계층 오류 — 실물 DB는 마음대로 죽일 수 없으므로 주입한다 (admin-management.spec.ts)
jest.spyOn(repo, 'update').mockRejectedValueOnce(new Error('boom'))

// 외부 스토리지 장애 (assets.spec.ts)
jest.spyOn(s3Service, 'deleteObject').mockRejectedValueOnce(new Error('s3 down'))

// 구매 기록 생성 실패 → 결제가 취소되는 보상 경로 (purchase.spec.ts)
jest.spyOn(purchaseRecordsService, 'create').mockImplementationOnce(() => {
    throw new Error('record creation failed')
})
```

전부 실패 주입이다. 의존성을 가짜로 바꿔치기해서 테스트를 편하게 만드는 용도가 아니라, 장애 상황을 재현해서 보상과 복구 경로를 검증하는 용도다. [purchase.spec.ts](https://github.com/mannercode/nest-seed/blob/main/apps/api/src/__tests__/integration/application/purchase.spec.ts)에는 한 걸음 더 나간 용례도 있다. 특정 메서드를 직접 가로채는 대신 Logger를 spy해서 특정 로그가 기록되는 순간 예외를 던진다 — 테스트가 구현 세부(메서드 이름)에 묶이지 않고 관측 가능한 지점에만 묶이게 하려는 것이다.

정리하면 규칙은 하나다. **경계 밖 시스템을 mock으로 대체하지 않는다. 실물로 돌리되, 실물로 만들 수 없는 실패만 주입한다.**

### 2.5. 커버리지 100%와 읽히는 테스트

nest-seed에는 테스트 규칙이 두 개 더 있다. 도구가 강제하는 것 하나, 사람이 지키는 것 하나.

**커버리지 100%를 못 채우면 npm test가 실패한다.** 90%를 목표로 두면 어떻게 될까. 나머지 10%가 어떤 코드인지 아무도 모른다. 테스트되지 않은 코드의 집합이 익명이 되는 것이다. 100%를 기준으로 두면 상황이 뒤집힌다. 테스트하지 않기로 한 코드는 명시적인 예외 선언으로 드러나야 하고, 그 선언 자체가 리뷰 대상이 된다. 저장소 전체에서 예외는 테스트 도구 자신인 libs/testing 하나뿐이다. 100%는 "모든 줄이 의미 있게 검증됐다"는 보증이 아니다. "검증 안 된 코드가 어디 숨어 있는지 모른다"는 상태를 없애는 장치다.

**describe는 조건, it은 결과다.** 테스트 코드는 사람이 읽는 문서이기도 하다. 코드 식별자를 가리키는 자리는 영어를 그대로 쓰고, 조건은 한글 절로, 결과는 한글 문장으로 적는다.

```
describe('ShowtimeCreationService')                    -- 클래스 이름. 영어
  describe('POST /showtime-creation/showtimes')       -- 엔드포인트. 영어
    describe('생성 도중 티켓 생성이 실패하면')              -- 조건. 한글 절
      beforeEach(...)                                  -- 조건을 만드는 셋업
      it('보상으로 생성된 상영 시간을 모두 삭제한다')        -- 결과. 한글 문장
```

조건은 beforeEach가 만들고 it은 검증만 한다. 이 규칙을 지키면 테스트 러너의 출력이 그대로 명세서가 된다. "생성 도중 티켓 생성이 실패하면 → 보상으로 생성된 상영 시간을 모두 삭제한다" — 실패한 테스트의 이름만 읽어도 어떤 약속이 깨졌는지 안다. 위에서 발췌한 테스트들이 술술 읽혔다면 이 규칙 덕분이다.

## 3. 결론

이번 글에서는 설계를 구현으로 옮기는 순서와 테스트 작성을 다뤘다. 연재의 마지막이니 흐름 전체를 접어서 보자.

bottom-up은 가장 구체적인 것(DB)부터 시작하기 때문에 쉽게 착수할 수 있지만, 함수마다 테스트를 작성하게 되고 인터페이스 변경이 테스트 수정의 연쇄를 일으킨다. top-down은 사용자의 요청(REST API)부터 시작하기 때문에 내부 구현이 바뀌어도 테스트는 그대로 유지된다. 개발하면서 자연스럽게 작성한 curl 명령이 spec이 되고, spec이 테스트 코드이자 실행 가능한 API 문서가 된다. unit의 단위는 함수가 아니라 하나의 동작이고, 조건과 실패 분기는 실제 인프라 위에서 도는 Jest 통합 테스트가 맡고, spy는 실물로 만들 수 없는 실패를 주입할 때만 쓴다.

1편에서 시작한 유스케이스 하나가 어디에 착지했는지 지도로 그리면 이렇다. 세 경로 모두 저장소에 실재한다.

{% plantuml %}
@startuml
left to right direction
usecase "상영시간 생성하기" as UC

rectangle "실행 가능한 API 문서 = 성공 흐름 테스트\napps/api/api-docs/showtime-creation.spec" as spec
rectangle "Jest 통합 테스트 — 조건·실패·보상 흐름\napps/api/src/**tests**/integration/\napplication/showtime-creation.spec.ts" as jest
rectangle "구현\napps/api/src/services/application/\nshowtime-creation/" as impl

UC --> spec : 성공 흐름을 먼저 쓴다
UC --> jest : 조건·실패 흐름을 쓴다
spec --> impl : 스텁부터 통과시키며\n아래로 내려간다
jest --> impl
@enduml
{% endplantuml %}

그리고 이 전체가 명령 하나로 재생된다.

```sh
npm run atoz
```

인프라 리셋과 의존성 설치부터 시작해서, 전체 워크스페이스의 lint와 테스트(커버리지 100% 게이트 포함)를 돌리고, 배포용 컨테이너를 세운 뒤 실행 가능한 API 문서 전체를 실행한다. 분석에서 시작해 설계, 구현, 테스트로 이어진 이 연재의 흐름이 저장소에서는 명령 하나의 파이프라인이다. 어느 단계가 깨져도 이 명령이 실패한다.

결국 이 연재에서 반복적으로 말하고 싶었던 것은 하나다. 분석, 설계, 구현, 테스트는 별개의 활동이 아니라 하나의 흐름이라는 것이다. 도메인 전문가와의 대화가 유스케이스가 되고, 유스케이스가 REST API가 되고, REST API가 spec이 되고, spec이 구현을 이끌고, 통합 테스트가 설계의 불변식을 고정한다. 이 흐름이 자연스러우면 TDD는 별도의 방법론이 아니라 개발 과정 그 자체가 된다. 그리고 이번 연재의 모든 문장은 nest-seed에서 직접 실행해서 확인할 수 있다.

> 소프트웨어 개발은 분석/설계/구현/검증이 물 흐르듯이 자연스럽게 흘러가야 한다.

---

이전 글: [백엔드 서비스 분석과 설계 — nest-seed로 증명하기 (3)]({% post_url 2026-07-04-nest-seed-design-3 %})
