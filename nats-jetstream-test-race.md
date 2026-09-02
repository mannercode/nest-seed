# AI 코딩 사례 연구 — `tickets.spec.ts`로 보인 NATS JetStream 파일 경합

이 문서는 2026년 9월 2일 `Test Stability` 실패를 두고 개발자와 AI가 주고받은 질문과 답변을 강의용 사례 연구로 다시 구성한 것이다. 목표는 최종 정답만 매끈하게 설명하는 것이 아니다. **AI 에이전트가 어떤 제안을 했고 그 제안에 무엇이 빠져 있었는지, 사람이 어떤 반문으로 전제와 범위를 바로잡았는지**를 보여 준다. 따라서 채택하지 않은 직렬화·sentinel 제안과 잘못 끌어온 동시 Vitest 가정도 사후적으로 지우지 않는다.

> **작성 시점의 상태:** 테스트 중 stream 삭제를 없애고, 테스트 stream의 `max_bytes`를 1 MiB로 낮추며, 현재 Vitest run의 stream을 global teardown에서 한 번 정리하도록 구현했다. 대상 테스트 11개, 격리 계약 7개, 전체 API 43개 파일·457개 테스트가 로컬에서 통과했고 종료 후 stream과 consumer가 0개인 것도 확인했다. 아직 GitHub `Test Stability`를 다시 실행하지 않았으므로 CI에서의 최종 해결까지 주장하지는 않는다.

## 1. 사건 요약

[실패한 Test Stability 실행](https://github.com/mannercode/nest-seed/actions/runs/33559467609)은 13개 행렬 잡 중 `unit-api-2` 하나만 실패했다. 이 leg는 `apps/api`의 Vitest suite를 한 회로 보고 20회 반복한다.

앞선 13회는 모두 통과했고 14회에서 다음 테스트가 실패한 것으로 표시됐다.

```text
src/__tests__/core/tickets.spec.ts
TicketsService > sellForPurchase
> 판매 가능한 티켓들을 구매에 귀속하고 판매 완료 상태로 반환한다
```

하지만 티켓의 상태나 MongoDB assertion이 틀린 것이 아니었다. 클라이언트가 받은 오류는 다음과 같았다.

```text
JetStreamApiError: error creating store for stream
```

같은 시점의 NATS 서버 로그에는 더 구체적인 원인이 남았다.

```text
Stream create failed for '$G > PURCHASE_EVENTS_...':
could not create storage directory -
mkdir /data/jetstream/$G/streams/PURCHASE_EVENTS_...:
no such file or directory (10077)
```

동일한 서버 오류는 [앞선 수동 Stability 실행](https://github.com/mannercode/nest-seed/actions/runs/33535288036)에서도 발생했다. 한 번뿐인 우연한 로그 손상보다는 반복 가능한 경합을 의심할 근거다.

### 핵심 교정 흐름

| AI 에이전트의 제안·설명                                                       | 제안에 있던 문제                                                           | 사람의 반문·결정                                               | 최종 반영                                                              |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 생성과 삭제를 직렬화하는 방안을 검토했다.                                     | worker 간 lock과 NATS의 비동기 후행 삭제까지 관리해야 했다.                | “언제 뭘 삭제한다고?”, “삭제 안 하면 되는 거 아냐?”            | 테스트 중 삭제 자체를 없앴다.                                          |
| 공유 부모가 비지 않도록 sentinel stream을 두자고 제안했다.                    | 별도 stream의 생성·검증·보존 lifecycle이 새로 생겼다.                      | “센티넬은 안 하면 좋겠다.”                                     | sentinel을 만들지 않았다.                                              |
| 1 MiB를 기본으로 두고 스트레스 테스트만 높이는 전용 옵션을 만들려 했다.       | 실제 상향 대상 테스트를 먼저 확인하지 않은 미래 설계였다.                  | “명시적 상향해야 하는 테스트가 어디 있지?”                     | 현재 상향 대상이 없음을 확인하고 전용 옵션을 추가하지 않았다.          |
| 다른 Vitest 실행의 global teardown과 stream 생성까지 겹칠 수 있다고 설명했다. | 실패한 Stability 반복은 순차 실행인데 별도 실행 모델을 원인 범위에 섞었다. | “global teardown이 다른 Vitest 실행의 스트림 생성과 겹치다니?” | 같은 run의 `afterEach` 삭제와 worker 생성 경합만 해결 대상으로 삼았다. |
| 원인 진단 뒤 해결안을 설명했다.                                               | 제안 완료와 해결 검증이 섞일 수 있었다.                                    | “그래서 문제 해결했다고?”                                      | 로컬 검증과 아직 남은 Stability 재실행을 분리해 기록했다.              |

## 2. 질문과 답변

### 질문 1. “GitHub Action 죽었는데? 그래서 문제 해결했다고?”

아니다. 처음 확인한 결과는 다음 세 단계 중 첫 두 단계까지였다.

1. **실패 확인:** 어느 잡과 어느 반복에서 무엇이 실패했는지 찾았다.
2. **원인 진단:** 티켓 로직이 아니라 NATS File stream 생성 중의 파일시스템 경합으로 좁혔다.
3. **해결 검증:** 코드를 바꾸고 동일한 병렬 조건에서 반복 실행한 뒤 CI를 다시 통과시킨다.

3단계를 하지 않았다면 “진단했다”라고 말할 수는 있어도 “해결했다”라고 말하면 안 된다. 수정안을 설명했다는 사실도 해결 증거가 아니다.

### 질문 2. “NATS stream이 각 테스트마다 생성되는 건가? DB처럼 `testId` 기반으로 각각 생성하잖아?”

NATS는 조건부로 테스트별이며, 현재 MongoDB는 테스트별 DB가 아니다.

| 자원           | 격리 단위                                                  | 테스트 사이 정리                                       |
| -------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| MongoDB        | Vitest run + worker별 DB                                   | 같은 DB의 모든 collection 문서를 `afterEach`에서 삭제  |
| S3             | Vitest run + worker별 bucket                               | 같은 bucket의 object를 `afterEach`에서 삭제            |
| NATS JetStream | `PurchaseEvents`를 초기화한 테스트의 `PROJECT_ID`별 stream | 테스트 중 유지하고 run의 global teardown에서 일괄 삭제 |

[공통 Vitest lifecycle](tools/vitest-helpers/index.js)은 `beforeEach`마다 임의의 10자 `testId`를 만들고, [API setup](apps/api/src/__tests__/vitest.setup.ts)은 이를 다음처럼 `PROJECT_ID`에 반영한다.

```text
project-r<API_VITEST_RUN_ID>-<testId>
```

[PurchaseEvents](apps/api/src/services/application/purchase/purchase.events.ts)는 그 값을 subject에 넣고, SHA-256 일부를 이용해 stream 이름을 만든다.

```text
subject:     project-r...-<testId>.purchase.ticketPurchased
stream name: PURCHASE_EVENTS_<PROJECT_ID의 해시 24자리>
```

Nest가 `PurchaseEvents.onModuleInit()`을 실행하면 `StorageType.File` stream과 durable consumer가 만들어진다. 수정 전에는 테스트가 끝날 때마다 API setup이 subject로 stream을 찾아 삭제했다. 수정 후에는 개별 테스트가 끝나도 stream을 유지하고, 모든 worker가 끝난 뒤 global teardown이 현재 run의 subject만 찾아 삭제한다.

다만 모든 단위 테스트가 stream을 만드는 것은 아니다. `AppModule` 또는 `PurchaseModule`을 시작하지 않는 순수 단위 테스트에는 이 과정이 없다. 반대로 [tickets.spec.ts](apps/api/src/__tests__/core/tickets.spec.ts)는 모든 `it`의 `beforeEach`에서 `createAppTestContext()`를 호출하므로, 티켓 테스트 본문이 NATS를 사용하지 않아도 매번 stream을 만든다.

### 질문 3. “이 때문에 무관한 NATS 장애가 `tickets.spec.ts` 실패로 표시된다고?”

도메인 로직 관점에서는 무관하지만, 테스트 fixture의 부팅 그래프에서는 연결돼 있다.

```text
tickets.spec.ts의 beforeEach
└─ createAppTestContext()
   └─ 전체 AppModule 시작
      └─ PurchaseModule 시작
         └─ PurchaseEvents.onModuleInit()
            └─ JetStream File stream 생성
```

[createAppTestContext](apps/api/src/__tests__/helpers/create-app-test-context.ts)는 `TicketsModule`만 가져오지 않고 전체 `AppModule`을 가져온다. Nest는 앱 초기화 과정에서 모든 `OnModuleInit` hook을 실행한다. 따라서 `PurchaseEvents`의 stream 생성이 실패하면 `tickets.spec.ts`의 `beforeEach`가 reject되고 테스트 본문은 실행되지 않는다.

Vitest는 실행 중이던 테스트에 setup 오류를 귀속하므로 화면에는 티켓 테스트 실패로 보인다. 이때 테스트 이름은 **오류가 관측된 위치**이지 반드시 **오류를 만든 기능**은 아니다.

더 정확한 표현은 다음과 같다.

> 티켓 assertion이 실패한 것이 아니라, 티켓 테스트가 사용한 전체 앱 fixture가 NATS 자원을 초기화하다 실패했다.

### 질문 4. “NATS 파일 저장소의 물리적 상위 디렉터리를 공유한다는 게 무슨 뜻인가?”

#### 논리적 격리와 물리적 배치가 다르다

테스트 A와 B의 subject와 stream 이름은 서로 다르다.

```text
test A → PURCHASE_EVENTS_<hash-A>
test B → PURCHASE_EVENTS_<hash-B>
```

하지만 두 테스트는 같은 NATS 서버의 같은 기본 계정 `$G`를 사용한다. `PROJECT_ID`는 NATS 계정을 새로 만들지 않는다. File storage의 실제 디렉터리는 다음과 같다.

```text
/data/jetstream/$G/streams/             ← 모든 테스트가 공유하는 부모
├── PURCHASE_EVENTS_<hash-A>/           ← 테스트 A 전용 말단
└── PURCHASE_EVENTS_<hash-B>/           ← 테스트 B 전용 말단
```

이것은 GitHub Actions의 서로 다른 잡이 같은 볼륨을 공유한다는 뜻이 아니다. **한 잡 안에서 같은 NATS 컨테이너를 사용하는 Vitest worker 프로세스들이 `$G/streams`를 공유한다**는 뜻이다.

#### NATS 삭제 경로

고정된 NATS 이미지는 [`.env.infra`](.env.infra)의 `nats:2.14.5-alpine`이었다. 이 버전의 NATS 서버는 File stream을 삭제할 때 stream 디렉터리를 숨은 이름으로 옮긴 다음 실제 파일 제거를 별도 goroutine에 맡긴다. 이어서 또 다른 goroutine이 대략 다음 정리를 실행한다.

```go
// 개념을 보여 주기 위한 축약 코드
go func() {
    os.Remove(accountDir + "/streams") // 비어 있을 때만 성공
    os.Remove(accountDir)
}()
```

실제 코드는 NATS Server v2.14.5의 [`stream.go`](https://github.com/nats-io/nats-server/blob/v2.14.5/server/stream.go#L8502-L8516)와 [`filestore.go`](https://github.com/nats-io/nats-server/blob/v2.14.5/server/filestore.go#L11673-L11728)에서 확인할 수 있다. `os.Remove()`는 디렉터리가 비어 있지 않으면 실패하므로 보통은 무해하다. 그러나 마지막 stream이 사라져 `$G/streams`가 잠깐 비면 부모 삭제가 성공할 수 있다.

클라이언트에서 다음 promise가 끝났다고 해서 서버의 모든 파일 정리 goroutine까지 끝났다는 뜻은 아니다.

```ts
await manager.streams.delete(streamName)
```

논리적인 stream 삭제 응답과 파일시스템의 후행 정리 사이에는 완료 장벽이 없다.

#### NATS 생성 경로와 실제 경합

새 File stream을 만들 때 NATS는 stream 전용 디렉터리를 확인하고 없으면 `os.MkdirAll()`로 만든다([`filestore.go`의 생성 코드](https://github.com/nats-io/nats-server/blob/v2.14.5/server/filestore.go#L421-L425)). `MkdirAll()`도 하나의 원자적 syscall이 아니라 부모 확인과 자식 생성이 나뉜 과정이다. 다음 순서가 가능하다.

```text
시간   worker A / NATS 삭제 경로               worker B / NATS 생성 경로
----   -------------------------------------   ----------------------------------------
T1     마지막 stream A 삭제 시작
T2     stream A의 숨은 디렉터리 제거 완료
T3                                             stream B가 없는 것을 확인
T4                                             MkdirAll이 `$G/streams` 부모를 확인
                                               → 이 순간에는 존재함
T5     비동기 정리가 빈 `$G/streams` 삭제 성공
T6                                             `$G/streams/PURCHASE_EVENTS_B` 생성
                                               → 부모가 사라져 ENOENT
```

이 경합이 발생하면 NATS가 남긴 오류가 정확히 다음 모양이 된다.

```text
mkdir /data/jetstream/$G/streams/PURCHASE_EVENTS_B:
no such file or directory
```

앞의 13회가 통과하고 14회만 실패한 이유도 여기에 있다. 잘못된 고정 설정이라면 매번 실패하지만, 이 오류는 부모 확인과 자식 생성 사이의 매우 짧은 시간 창에 스케줄링이 겹쳐야 나타난다.

여기서 관찰과 추론을 구분해야 한다.

- **직접 관찰:** CI의 `ENOENT` 경로, 실패 stack, NATS 서버 로그, 14번째 반복이라는 사실.
- **소스에서 확인:** 생성 경로의 `MkdirAll`, 삭제 경로의 비동기 `os.Remove`, 테스트별 생성·삭제 lifecycle.
- **소스 기반 추론:** 두 경로가 위 순서로 교차해 부모가 사라졌다는 인과관계. 당시 syscall 단위 trace를 수집한 것은 아니다.

따라서 처음의 “공유 구조 때문에 실패했다”는 표현은 너무 넓다. 정확한 문장은 다음과 같다.

> 같은 NATS 계정의 File stream들이 부모 디렉터리를 공유하고, 마지막 stream 삭제가 그 부모를 비동기로 제거하며, 다른 worker가 동시에 새 stream을 생성했기 때문에 실패했다.

### 질문 5. “생성·삭제를 직렬화하면 문제가 있나?”

**AI 에이전트가 먼저 검토한 제안은 생성과 삭제의 직렬화였다.** 직렬화의 범위에 따라 다음 문제가 생겼다.

#### JavaScript mutex만 두는 경우

[Vitest 기본 설정](vitest.config.base.mjs)은 `pool: 'forks'`다. 일반적인 메모리 mutex는 프로세스 하나 안에서만 보이므로 다른 fork의 생성·삭제를 막지 못한다. 진짜 직렬화에는 파일 lock, 별도 coordinator 또는 NATS 자체를 이용한 cross-process lock이 필요하다.

#### cross-process lock으로 API 호출만 감싸는 경우

다음 두 호출의 겹침은 막을 수 있다.

```text
streams.delete(A)
streams.add(B)
```

하지만 `delete(A)` 응답 뒤에도 NATS의 파일 정리 goroutine이 남을 수 있다. lock을 해제한 다음 `add(B)`가 시작될 때 후행 부모 삭제가 실행될 수 있으므로, **클라이언트 API 호출만 직렬화하는 것으로는 완료 장벽이 되지 않는다**.

#### 테스트 전체 생명주기를 직렬화하는 경우

앱 부팅부터 `streams.delete()` 응답까지 lock을 잡아도 같은 문제가 남는다. lock을 푼 뒤 서버의 후행 정리가 실행되면 다음 테스트의 생성과 다시 겹칠 수 있기 때문이다. 확실하게 직렬화하려면 서버의 파일 정리 완료까지 확인하는 장벽이 추가로 필요하지만 현재 JetStream 삭제 API는 그 장벽을 제공하지 않는다.

그 장벽까지 별도로 구현한다고 해도 455개 테스트의 병렬성을 크게 잃고, 실제 동시 실행에서 드러날 수 있는 문제까지 숨긴다. 안정성 테스트의 목적과도 맞지 않는다.

고정된 sleep을 추가하는 방법도 서버 정리 시간의 상한을 보장하지 않으며 CI 속도에 따라 다시 흔들린다. 따라서 직렬화와 sleep은 우선 해결책으로 적합하지 않다.

### 질문 6. “삭제 안 하면 되는 거 아냐? 언제 무엇을 삭제한다는 거야?”

**사람의 이 반문이 해결 방향을 바꿨다.** 원래 장애는 테스트마다 다음 순서를 반복해서 만들었다.

```text
test A 앱 시작 → stream A 생성 → test A 종료 → stream A 삭제
test B 앱 시작 → stream B 생성 → test B 종료 → stream B 삭제
```

worker들이 병렬로 실행되므로 한 worker의 삭제와 다른 worker의 생성이 교차할 수 있었다. 개별 stream은 테스트가 다시 읽어 쓰는 공유 fixture가 아니고 `PROJECT_ID`로 격리돼 있으므로, 테스트 직후 지울 기능적 이유는 없다. 생명주기를 다음처럼 바꿨다.

```text
Vitest run 시작
├─ test A → stream A 생성 ┐
├─ test B → stream B 생성 ├─ 테스트 중에는 삭제하지 않음
└─ test N → stream N 생성 ┘
모든 테스트와 worker 종료
└─ global teardown 1회 → 현재 run의 stream A..N 삭제
```

global teardown은 `API_VITEST_RUN_ID`를 검증한 뒤 정확히 다음 subject 형식만 고른다.

```text
project-r<현재 run ID>-<test ID>.purchase.ticketPurchased
```

따라서 “삭제하지 않는다”는 영구 방치가 아니라 **테스트 사이에는 삭제하지 않고 run 경계에서 한 번 정리한다**는 뜻이다.

### 질문 7. “stream이 모두 사라지면 sentinel이 삭제된다는 얘기야? 센티넬은 안 하면 좋겠다.”

**sentinel은 AI 에이전트가 제안한 대안이지 사람의 제안이 아니다.** 이 장애에서 `sentinel`이라는 말은 NATS가 자동으로 만드는 특수 파일이 아니라, `$G/streams`가 비지 않도록 일부러 유지하는 별도 File stream을 뜻했다. 모든 일반 stream이 사라져도 그 stream을 남겨 부모 디렉터리 삭제를 막자는 아이디어였다.

하지만 테스트 중 삭제 자체가 불필요하다는 더 단순한 해법이 확인됐으므로 sentinel은 만들지 않았다. 추가 subject, 설정 검증, 초기화와 정리 규칙도 전부 필요 없어졌다.

### 질문 8. “그냥 `max_bytes`를 1 MiB로 하지? 테스트 setup에서 바꿀 수 있나?”

가능하고 그렇게 적용했다. 다만 운영의 구매 완료 이벤트 보존 계약까지 1 MiB로 낮추지는 않았다.

- `PurchaseModule`의 운영 기본값은 기존과 같은 256 MiB다.
- `createAppTestContext()`는 stream을 만들기 전 Nest provider를 1 MiB로 override한다.
- 따라서 전체 앱 통합 테스트에서 만들어지는 각 stream만 1 MiB 한도를 쓴다.

global teardown까지 stream을 유지하면 동시에 존재하는 stream 수가 늘어난다. `max_bytes`는 실제 payload 크기와 별개로 JetStream의 저장 용량 한도 계산에 쓰이므로, 테스트에서 사용하지 않는 256 MiB를 stream마다 예약할 이유가 없다. 실제 구매 이벤트 테스트는 테스트당 1~2건, 수백 바이트 수준이어서 1 MiB면 충분하다.

### 질문 9. “기본은 1 MiB로 하고 NATS 스트레스 테스트만 선별해서 올리자는 얘기다. 그런 테스트가 어디 있지?”

**사람이 제시한 원칙은 스트레스 테스트가 실제로 있을 때만 선별 상향하자는 것이었다.** AI 에이전트는 이를 곧바로 별도 테스트 옵션으로 만들려 했지만, 사람이 먼저 사용처를 물었다. 확인 결과 현재 상향 대상은 없다. `purchase-events.spec.ts`는 내구성·중복 억제·재전달을 검증하지만 용량을 채우는 부하 테스트는 아니다. `vitest-resource-isolation.spec.ts`도 1 MiB stream 하나를 직접 만들 뿐 상향할 이유가 없다.

따라서 이번 변경에 미사용 “스트레스 테스트용 상향값”은 추가하지 않았다. 나중에 실제로 1 MiB 한계 동작을 검증하는 테스트가 생기면 그 테스트가 기존 provider override 통로로 필요한 값을 명시하게 한다. 요구가 생기기 전에 이름뿐인 설정을 만드는 것보다 테스트의 의도를 그 시점에 코드로 드러내는 편이 낫다.

### 질문 10. “global teardown이 다른 Vitest 실행의 stream 생성과 겹친다니?”

**이는 AI 에이전트가 해결 범위를 불필요하게 넓히며 한 잘못된 설명이었다.** 이 장애의 GitHub Stability 실행에서는 겹치지 않는다. 한 행렬 leg의 `repeat.sh`는 Vitest 명령 하나가 global teardown까지 끝난 뒤 다음 명령을 시작한다. 한 Vitest run 안에서도 global teardown은 모든 테스트와 worker가 끝난 뒤 실행된다.

따라서 채택한 해결책의 핵심은 **같은 run 도중 발생하던 `afterEach` 삭제와 다른 worker의 생성을 분리하는 것**이다. 별도의 두 Vitest 명령을 동시에 수동 실행하는 상황은 이 Stability 장애의 실행 모델과 섞어 설명하면 안 된다. 최초 설명에서 전용 병렬 invocation 격리 하네스까지 원인 경로에 포함한 것은 범위를 과하게 넓힌 설명이었다.

#### 검증 결과와 남은 단계

1. `purchase-events.spec.ts` 11개가 통과해 테스트 stream의 1 MiB 계약을 실제 NATS에서 확인했다.
2. Vitest 격리 계약 7개가 통과해 직전 테스트의 stream이 유지되고 현재 run의 global teardown만 선택되는 것을 확인했다.
3. `pool: 'forks'`인 전체 API suite 43개 파일·457개 테스트가 통과했다.
4. 실행 중 관찰 시 stream과 consumer가 각각 285개까지 누적됐고, 종료 후에는 모두 0개였다.
5. 해당 실행 구간의 NATS 로그에는 storage 생성·삭제 오류가 없었다.

로컬 한 번의 전체 통과는 구현이 의도대로 작동한다는 증거지만, 원래 실패가 14번째 반복에서 나타난 간헐 경합이었던 만큼 마지막 완료 조건은 GitHub `Test Stability`의 API 세 레그를 다시 통과하는 것이다.

#### 근본 해결과 후속 구조 개선

- **근본 해결:** NATS upstream에 재현과 로그를 보고하고, 공유 부모 삭제와 생성이 동기화되거나 삭제 경로가 공유 부모를 제거하지 않도록 수정된 버전을 사용한다.
- **fixture 경계 축소:** 티켓 테스트는 `TicketsModule`에 필요한 provider만 시작하게 바꿀 수 있다. 그러면 구매 이벤트 장애가 티켓 테스트까지 전파되지 않고 부팅 비용도 줄어든다. 다만 실제 NATS를 사용하는 테스트의 파일 경합 자체는 별도로 해결해야 한다.

다음 대안은 우선순위가 낮다.

| 대안                                      | 한계                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 테스트 전체를 `StorageType.Memory`로 변경 | File storage의 실제 동작을 검증하지 못한다.                                                         |
| stream 생성 실패를 무조건 retry           | `error creating store`가 디스크 용량·권한 같은 영구 장애도 포함할 수 있어 진짜 장애를 가릴 수 있다. |
| 모든 NATS 테스트 직렬화                   | 실행 시간이 늘고 동시성 문제를 숨긴다.                                                              |
| NATS 버전만 올리기                        | 해당 부모 정리 코드가 수정됐다는 근거와 반복 검증 없이는 해결이라고 볼 수 없다.                     |

## 3. 이 사례에서 배우는 AI 코딩 원칙

### 실패한 테스트 이름은 출발점이지 결론이 아니다

`tickets.spec.ts`가 빨갛다는 이유로 `TicketsService`부터 고치면 잘못된 변경을 만들기 쉽다. 먼저 실패가 테스트 본문, `beforeEach`, `afterEach`, global setup 중 어디서 났는지 구분한다.

### 논리적 ID 격리와 물리적 자원 격리를 구분한다

고유한 `PROJECT_ID`, subject, stream 이름은 이름 충돌을 막는다. 그러나 같은 NATS account, 같은 프로세스 내부 자료구조, 같은 파일시스템 부모까지 격리하지는 않는다. 분산 시스템 문제에서는 식별자뿐 아니라 그 아래의 실제 공유 자원까지 추적해야 한다.

### 외부 시스템 오류는 서버 로그와 해당 버전의 소스를 본다

클라이언트의 `error creating store for stream`은 너무 일반적이었다. 서버 로그의 정확한 경로와 고정된 NATS 버전의 생성·삭제 코드를 함께 봐야 파일시스템 경합까지 좁힐 수 있었다.

### 사실, 추론, 제안을 같은 문장에 섞지 않는다

| 단계      | 이 사건의 예                                                        |
| --------- | ------------------------------------------------------------------- |
| 사실      | NATS가 `mkdir ... no such file or directory`를 기록했다.            |
| 코드 사실 | 삭제는 공유 부모를 비동기로 지우고 생성은 그 아래에 `MkdirAll`한다. |
| 인과 추론 | 삭제와 생성의 교차로 부모가 생성 도중 사라졌다.                     |
| 해결 제안 | 테스트 중 stream을 지우지 않고 run의 global teardown에서 정리한다.  |
| 해결 증거 | 로컬 전체 suite는 통과했고 Stability 재실행은 아직 남았다.          |

### 사용자의 반문은 조사 품질을 높이는 테스트다

이 대화에서 특히 중요한 질문은 다음과 같았다.

- “무관한 NATS 장애가 `tickets.spec.ts` 실패라고?” — 테스트 이름과 setup 실패의 인과관계를 분리하게 했다.
- “삭제 안 하면 되는 거 아냐?” — AI가 제안한 lock과 sentinel보다 작은 해결책을 찾게 했다.
- “명시적 상향해야 하는 테스트가 어디 있지?” — 확인하지 않은 미래 요구를 구현하지 못하게 했다.
- “다른 Vitest 실행과 겹친다니?” — 실제 workflow 밖으로 넓어진 설명을 되돌렸다.
- “그래서 문제 해결했다고?” — 원인 진단과 검증 완료를 구분하게 했다.

AI의 첫 설명이 그럴듯해 보여도, 숫자·실행 경계·완료 조건을 되묻는 것이 중요하다. 좋은 AI 코딩 협업은 답을 빨리 수용하는 과정이 아니라, 답이 반증 가능한 형태가 될 때까지 함께 좁히는 과정이다.

## 4. 강의 진행 예시

1. 수강생에게 `tickets.spec.ts` 실패 이름만 보여 주고 어디부터 조사할지 묻는다.
2. stack이 테스트 본문이 아니라 `beforeEach → onModuleInit`으로 향한다는 사실을 공개한다.
3. `createAppTestContext → AppModule → PurchaseEvents` 부팅 그래프를 그린다.
4. 테스트별 stream 이름과 공유 `$G/streams` 디렉터리를 나란히 보여 준다.
5. 삭제와 생성의 시간표를 주고 어느 사이에 `ENOENT`가 가능한지 찾게 한다.
6. 직렬화·sleep·Memory storage·retry·sentinel·run 단위 정리를 비교하게 한다.
7. 마지막으로 “원인을 설명한 지금 해결됐다고 말할 수 있는가?”를 묻고 검증 계획을 작성하게 한다.

이 순서로 진행하면 로그 읽기, 테스트 경계, 외부 시스템 소스 분석, 경합 조건, 해결안의 trade-off, 완료 주장에 필요한 증거를 한 사례 안에서 다룰 수 있다.
