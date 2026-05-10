# tests/ — 메모리 누수 추적 도구

apps/api 통합 테스트의 V8 heap OOM (CI test-atoz) 누수 추적용 측정 도구.
`npm run atoz` 흐름과 분리돼 있어 사용자가 언제든 직접 실행해 결과를 확인할
수 있다.

## 디렉터리

| 위치 | 목적 |
|---|---|
| `minimal/` | jest + 큰 npm 모듈 require 만 한 깨끗한 spec. `resetModules` 효과를 코드베이스 무관하게 검증 |
| `fixture-leak/` | apps/api 의 `createAppTestContext` 를 N 번 부팅·teardown 하면서 메모리 측정. fixture 단위 누수량 확인 |
| `snapshot-diff/` | `v8.writeHeapSnapshot` 두 개를 streaming 으로 비교해 retained 클래스 분포 출력 |

## 실행 전제

`fixture-leak` 은 mongo/redis/nats/temporal/minio 인프라가 떠 있어야 한다:

```bash
bash .devcontainer/infra/reset.sh
```

`minimal` 은 외부 인프라 불필요.

## 실행

### minimal — resetModules 가설 검증

```bash
bash tests/minimal/run.sh        # true / false 둘 다 비교
bash tests/minimal/run.sh true   # resetModules:true 만
bash tests/minimal/run.sh false  # resetModules:false 만
```

각 spec 끝에 `[probe] specN.test.js rss=… heap=… ext=… exec=… mallocedMem=…`
형태로 stderr 에 출력된다. testFile 사이의 RSS 점프가 jest/resetModules 자체
에서 오는지 코드베이스 특정 문제인지 가설 검증.

### fixture-leak — fixture-당 누수량 측정

```bash
bash tests/fixture-leak/run.sh        # 기본 N=6
bash tests/fixture-leak/run.sh 10     # N=10
FIXTURE_LEAK_N=20 bash tests/fixture-leak/run.sh
```

`baseline` + `after-fixture-1..N` 의 메모리 추이가 출력된다. 누수가 fixture
부팅에 비례한다면 `after-fixture-N` 의 RSS/heap 이 N 에 비례해 증가해야
한다.

### snapshot-diff — heap snapshot 두 개 비교

`v8.writeHeapSnapshot` 으로 만든 `.heapsnapshot` 두 개를 비교해 어떤 class
가 추가로 retained 되는지 본다. **주의**: snapshot 호출 자체가 ~1GB RSS
누적 부수효과를 만든다 (측정 도구가 측정 대상에 끼어듦). 가설 좁힐 때만
쓴다.

```bash
node tests/snapshot-diff/diff.js <snap1> <snap2>            # 모든 class
node tests/snapshot-diff/diff.js <snap1> <snap2> --user-only # user class 만
```

NodeJS heap 외부 메모리(stream parsing) 가 부족하면:
```bash
NODE_OPTIONS='--max-old-space-size=8192' node tests/snapshot-diff/diff.js …
```

## 지금까지 검증된 가설

| 가설 | 결과 |
|---|---|
| `resetModules:true` 가 누수원 | **거짓**. true vs false 차이 ~30MB |
| testFile 전환 자체 누수 | **거짓**. snapshot 빼면 전환당 +30MB |
| fixture 부팅·teardown 누수 | **거짓**. 6 번 부팅에 +5MB (첫 부팅 +130MB 는 process-lifetime 캐시) |
| `v8.writeHeapSnapshot` 부수효과 | **참**. 호출당 +~1GB RSS 점프 |
| 실제 통합 spec 의 비즈니스 로직 누수 | **미검증**. 다음 추적 대상 |

## 측정 후 정리

`tests/` 의 모든 파일은 누수 추적 끝나면 통째 삭제 가능. apps/api 의
production 코드/설정에는 영향 없게 격리돼 있다.
