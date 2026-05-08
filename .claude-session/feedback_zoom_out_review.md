---
name: 검토할 때 line-level 버그뿐 아니라 architectural coherence도 본다
description: 코드 검토 시 파일별 버그만 찾지 말고 "이 공유/추상이 실제 소비자 모두에게 정합한가?"를 묻는다
type: feedback
originSessionId: 4feaead6-5c0f-4a90-a339-97849cbed5ed
---
코드 검토 작업에서 line-level 버그만 사냥하지 말고, 매 라운드 한 번씩은 **architectural coherence** 질문을 한다:

- 이 공유 config/모듈/abstraction이 실제 *모든 소비자에게* 정합한가?
- 한 소비자만 진짜로 필요로 하는데, 다른 소비자도 부수적으로 끌려가는 구조 아닌가?
- 의존 방향이 자연스러운가? (예: env *생성자*와 *소비자 helper*가 같은 자리에 있는가)
- 파일/디렉터리의 위치가 sole-consumer 기준으로 어색하지 않은가?

**Why:** 사용자 피드백 — "너는 왜 이런 문제를 찾지 못하지? 시간 많이 준거 같은데" — line-level 버그만 사냥했고 architectural smell을 놓쳤음. 구체적으로 libs/testing이 libs/common의 jest.global.js를 inherit해서 인프라 없는 라이브러리가 5개 컨테이너를 매번 부팅하는 design issue를 사용자가 지적해서야 발견.

**의도 추측을 먼저**: 어색해 보이는 자리(시드 src/에 들어 있는 메타-튜토리얼, 단일 파일 모듈의 inline errors 등)를 발견하면 *flag하기 전에* "왜 의도적으로 그렇게 뒀을 가능성이 있는가?"를 한 번 묻는다. 사용자 피드백: "의도를 잘 추측해야지". 시드의 경우 학습용 reference, fork-er 가이드 등 비-자명한 의도가 자주 있음. 단순한 컨벤션 위반처럼 보여도 **모듈 크기 / 외부 학습 가치 / fork 시점의 첫 인상** 같은 차원이 있을 수 있다. 구체 사례:
- libs/testing/src/jest/__tests__/ 의 메타-튜토리얼 → 시드 fork-er가 jest 패턴을 학습하는 *살아있는 reference*. 일반 라이브러리라면 src/에 둘 자리 아니지만 시드라 의도된 것.
- 단일 파일 모듈(lat-long, pagination)의 inline `Errors` → 별도 errors.ts로 분리하는 컨벤션은 *디렉터리 안* 패턴이라 의미가 있고, 모듈 자체가 한 파일이면 inline이 자연스러움.

**How to apply:** 검토 라운드에서 코드 사냥 외에 다음 체크리스트:
- 모든 jest config 한번에 비교: 누가 뭘 inherit하는지, 그게 실제 필요한지
- 모든 shared module의 실제 importer 그래프: import가 single-consumer면 그 소비자 안으로 옮길 수 있는지
- 각 lib/패키지의 자체 테스트가 *실제로 사용하는* 자원과 *부팅되는* 자원의 차이
- `__tests__` 안의 fixture가 진짜로 import하는 모듈을 sample로 한 번이라도 직접 본다 (config만 보고 추정 X)
- **package.json의 `dependencies` / `peerDependencies` 그래프를 그려본다**. 패키지 cycle 또는 단방향이어야 할 의존이 양방향으로 묶여있는 곳을 찾는다 (예: test-helper lib의 production code가 production-utility lib에 peerDep으로 묶이면, 단 한 줄 import 때문에 전체 dep tree가 종속). 사용자 피드백: "거국적으로다가 찾아봐라" — 매 라운드 의존 graph 단방향성을 명시적으로 검사한다.
- **자기 자신이 만든 layer 개수를 센다**. type augmentation file, helper function, alias — runtime 보호가 이미 있는 자리에 *additional convenience layer*가 있으면 제거 후보. 사용자 피드백: "왜 자꾸 오바야".
- **중복 함수의 추출은 *식별 즉시* 적용한다**. R6 audit에서 "ensureBucket / setup lifecycle 중복"을 발견하고도 *제안 단계*에 멈췄다가 사용자가 다시 짚어주는 일이 있었음 — 식별과 적용 사이의 lag를 줄인다.
