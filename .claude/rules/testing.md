---
paths:
    - 'libs/*/src/__tests__/**'
    - 'apps/*/src/__tests__/**'
    - 'apps/*/tests/**'
---

# 테스트 컨벤션

## 구조

```
describe('ServiceName')                       -- 최상위: 서비스/모듈명 (한글 주석 없음)
  describe('POST /resource')                  -- 엔드포인트/메서드명 (한글 주석 없음)
    describe('when the condition is met')     -- 조건 (위에 한글 주석)
      beforeEach(...)                         -- 조건 실현
      it('returns the result')               -- 결과 검증 (위에 한글 주석)
```

## 규칙

1. describe (서비스/엔드포인트/메서드) — 한글 주석 없음
2. describe (조건) — `when ~`으로 시작. 위에 한글 주석: `~할 때` / `~되었을 때`
3. it (결과) — 조건 포함하지 않음. 위에 한글 주석: `~한다` / `~반환한다` / `~던진다`
4. beforeEach — 부모 describe의 `when ~` 조건을 구현. `it`에서는 검증만
5. step — E2E 시나리오에서 순차 의존 단계. 영어만, 한글 주석 없음

## 한글 주석 스타일

- 조건: `~할 때`, `~되었을 때`, `~않았을 때` (`~된 때`, `~않은 때` 사용하지 않음)
- 결과: `~한다`, `~반환한다`, `~던진다`
- 한글 주석은 `describe`나 `it` 바로 위 줄에 배치

## Fixture 패턴

- `createXxxFixture()`로 격리된 테스트 컨텍스트 생성
- `afterEach`에서 `fix.teardown()` 호출
- Mock 없음 — 실제 MongoDB RS, Redis Cluster, NATS, MinIO, Temporal 사용
- 커버리지 100% 강제 (branches, functions, lines, statements)

## 데이터 기반 테스트

단순 입력/출력 검증에는 `it.each`를 사용하여 독립 리포팅.

## 변경 테스트 분리

PATCH, DELETE 등 상태 변경 API 테스트 시, 응답 검증과 영속성(DB) 검증은 별도 `it`으로 분리.

## Dynamic Import

`resetModules: true` + dynamic import로 각 테스트마다 독립된 환경 보장. 타입 전용 import(`import type`)만 최상위에 사용.
