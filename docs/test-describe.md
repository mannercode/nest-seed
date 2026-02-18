# Test `describe`/`it` 가이드

## 목적

- 테스트 제목(`describe`, `it`)만 보고 테스트 의도와 실패 원인을 바로 파악할 수 있게 한다.
- `src/apps` 전반에서 제목 스타일을 통일해 탐색 비용을 줄인다.

## 코드 분석 요약 (`src/apps`, 2026-02-18)

- 전체 `.spec.ts`: 22개
- `describe('when ...')` 패턴: 122회
- `it('returns ...')` 패턴: 124회
- `it('throws ...')` 패턴: 6회
- 2단계 `describe`는 두 스타일이 공존한다.
    - 라우트 기반: `describe('GET /customers/:id')`
    - 메서드 기반: `describe('create')`, `describe('search')`

현재 코드의 주 패턴은 이미 좋다:

- `describe(큰 범위)` -> `describe(행위/엔드포인트)` -> `describe(조건)` -> `it(결과)`

## 핵심 규칙

### 1) `describe` 계층

- 1단계(최상위): 넓은 이름 허용  
  예: `describe('CustomersService')`
- 2단계: 테스트 대상의 인터페이스 단위
    - API 테스트면 `HTTP METHOD + route`
    - 순수 단위 테스트면 메서드/함수명
- 3단계: 상태/조건을 `when ...`으로 기술

### 2) `describe` 문구

- 조건 블록은 `when ...` 형식을 기본으로 한다.
- 구현 디테일보다 비즈니스 상태를 쓴다.
    - 좋음: `when the customer does not exist`
    - 지양: `when findById returns null`

### 3) `it` 문구

- 결과를 관찰 가능한 형태로 쓴다.
- 기본 동사:
    - HTTP 응답 검증: `returns ...`
    - Promise rejection 자체 검증: `throws ...`
    - 상태 변화 검증: `persists ...`, `invalidates ...`, `creates ...`
- 한 테스트 제목에는 하나의 핵심 결과만 담는다.

### 4) `returns` vs `throws` 사용 기준

- 클라이언트/HTTP 관점으로 결과를 받는 테스트: `returns ...`
- 서비스 호출 결과를 `rejects`로 직접 검증하는 테스트: `throws ...`
- 같은 레이어/스타일에서 `returns`와 `throws`를 섞어 쓰지 않는다.

### 5) 라우트 표기

- 라우트 파라미터는 가능한 실제 의미를 쓴다.
    - 권장: `:showtimeId`
    - 덜 명확: `:id`

### 6) 팀 정책 반영

- 넓은 `describe` 이름 허용 (`describe('CustomersService')` 등)
- 축약 변수명 허용 (`yymmdd`, `uploadRes` 등)
- `AppTestContext & {}` 허용
- 디버그/참고용 주석 블록 유지 가능

## 권장 템플릿

```ts
describe('CustomersService', () => {
    describe('GET /customers/:customerId', () => {
        describe('when the customer does not exist', () => {
            it('returns 404 Not Found', async () => {
                // ...
            })
        })
    })
})
```

```ts
describe('getMany', () => {
    describe('when the ids include a non-existent id', () => {
        it('throws 404 Not Found', async () => {
            // ...
        })
    })
})
```

## 리뷰 체크리스트

- `describe` 계층이 `대상 -> 행위 -> 조건` 순서인가?
- 조건 블록이 `when ...`으로 통일되어 있는가?
- `it`이 관찰 결과를 말하는가?
- HTTP 테스트인데 `throws`를 쓰거나, rejection 테스트인데 `returns`를 쓰고 있지 않은가?
- 라우트 파라미터명이 도메인 의미를 전달하는가?
