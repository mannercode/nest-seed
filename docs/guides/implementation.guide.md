# Implementation Guide

코드를 작성할 때 고민하게 되는 물리적인 규칙을 설명한다.

## Naming Rules

### 1. find vs get

함수명이 find...인 경우와 get...인 경우가 있는데 요청한 리소스가 없을 때 처리 방법이 다르다.

```ts
/**
 * 만약 해당 Seed가 없다면 null을 반환한다.
*/
findSeed(seedId: string)

/**
 * 만약 해당 Seed가 없다면 예외를 발생시킵니다.
*/
getSeed(seedId: string)
```

찾는 것이 없을 수도 있기 때문에 find는 null을 반환한다. 그러나 존재하지 않는 것을 가지려고 한다면 오류이기 때문에 get은 예외를 발생시킨다.

### 2. 함수명에 전달인자 언급 피하기

전달인자를 함수명에 반영하면 유연성이 떨어지고 읽기 어렵다.

```ts
// 함수명에 전달인자 정보를 넣는 것은 피한다.
findTheatersForMovie(movieId)

// 대신 아래와 같이 object로 받는다.
findTheaters({movieId})
```

### 3. 테스트 설명 형식

When [Condition], expect [Error Type]

1. 실패 케이스\
    "should return [Error Type] when [Condition]"\
    "should return NOT_FOUND(404) when movieId is not found"

2. 성공 케이스\
    "should [Action] and return [Error Type]"\
    "should create a new resource and return CREATED(201)"

## Domain 레이어

### TypeORM과 도메인의 Entity 관계

다음은 일반적인 Entity를 구현한 코드다.

```ts
@Entity()
export class Seed extends TypeormEntity {
    @Column()
    name: string

    @Column({ type: 'text' })
    desc: string

    @Column({ type: 'integer' })
    integer: number

    @Column('varchar', { array: true })
    enums: SeedEnum[]

    @Column({ type: 'timestamptz' })
    date: Date
}
```

Entity 코드와 Infrastructure 레이어에 위치하는 TypeORM의 코드가 섞여 있다. 두 레이어의 코드가 섞여 있지만 Entity 코드는 Infrastructure 코드를 참조하지 않는다.

마찬가지로 TypeORM의 @Column 데코레이터는 데이터 매핑을 위한 것이고, 이 코드가 도메인 객체 내에 있어도 도메인 로직에 영향을 미치지 않는다.

결과적으로, 도메인 객체에 TypeORM 코드가 추가된 것은 엔티티와 ORM 사이의 편리한 연결을 위한 것이다. 이것은 TypeORM이 도메인 엔티티에 의존하게 하고, 엔티티가 TypeORM에 의존하지 않게 한다. 이 구조는 DDD의 개념과 상충하지 않으며, 두 영역 간의 깔끔한 분리를 제공한다.

## 그 외

### Exception의 테스트 작성

Exception을 발생시키는 것은 일반적인 방법으로 재현하기 어렵다. 그래서 Exception을 테스트 하려면 코드가 복잡해진다.
그에 반해 Exception을 처리하는 코드는 단순한 편이어서 테스트를 작성하는 이익이 크지 않다.

따라서 Exception에 대한 테스트는 작성하지 않는 것을 원칙으로 한다.

예외적으로 치명적인 Exception 발생 시 시스템을 shutdown 하는 것과 같이 단순 error reporting 이상의 기능이 있다면 테스트를 작성해야 한다.

### Code Coverage 무시

아래처럼 Assert를 사용하면 code coverage를 무시하는 태그를 작성하지 않아도 된다.

```js
/* istanbul ignore if */
if (seed === undefined) {
    throw new LogicException(`Seed(${seedId}) not found`)
}

// 간단하게 작성한다
Assert.defined(seed, `Seed(${seedId}) not found`)
```

### Test 작성

유닛 테스트를 클래스 마다 작성하는 것은 비용이 크다. e2e에 가까운 모듈 테스트를 작성해서 모듈 단위로 테스트를 작성하는 게 효율적이다.

테스트 코드는 반드시 완전한 e2e-test나 unit-test로 작성할 필요는 없다. 상황에 따라 어느 정도 균형을 맞춰야 한다.

### Transaction

서비스 간 트랜잭션 핸들을 공유하지 않는다. 전통적인 트랜잭션 구조는 포기한다. 각 서비스가 MSA의 일부라고 가정한다.

### Scope.REQUEST

아래와 같이 Scope.REQUEST로 설정된 TransactionService를 사용하면 scope bubble up 이 발생해서 unit 테스트가 어려워진다.

```ts
@Injectable({ scope: Scope.REQUEST })
export class TransactionService implements OnModuleDestroy {
    private queryRunner?: QueryRunner

    constructor(private dataSource: DataSource) {}

    async onModuleDestroy() {
        if (this.queryRunner && !this.queryRunner.isReleased) {
            await this.rollbackAndRelease()
        }
    }

    async startTransaction(): Promise<void> {
        if (!this.queryRunner) {
            this.queryRunner = this.dataSource.createQueryRunner()
            await this.queryRunner.connect()
        }

        try {
            await this.queryRunner.startTransaction()
        } catch (error) {
            throw new SystemException(`Failed to start a new transaction(${error})`)
        }
    }

    ...
}
```

### import 규칙

```
src
├── controllers
│   ├── index.ts
│   ├── auth.controller.ts
│   └── users.controller.ts
└── services
    ├── auth
    │   ├── index.ts
    │   ├── auth.service.ts
    │   └── strategies
    └── users
        ├── index.ts
        ├── users.repository.ts
        └── users.service.ts

```

위와 같은 폴더/파일 구조가 있을 때 순환 참조를 피하기 위해서 다음의 규칙을 지켜야 한다.

-   직계 조상 폴더는 절대 경로를 사용하면 안 된다.
    ```ts
    /* users.service.ts에서 */
    // 순환참조 발생
    import { AuthService } from 'src/services'
    // 정상
    import { AuthService } from '../auth'
    ```
-   직계 조상이 아니면 절대 경로를 사용해야 한다.
    ```ts
    /* users.controller.ts에서 */
    // 정상
    import { AuthService } from 'src/services'
    // 권장하지 않음
    import { AuthService } from '../services'
    ```
