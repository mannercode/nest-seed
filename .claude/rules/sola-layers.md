---
paths:
    - 'seeds/mono/src/**/*.ts'
    - 'seeds/msa/src/**/*.ts'
---

# SoLA 레이어 규칙

## 의존 방향

```
Controllers (Gateway) → Applications → Cores → Infrastructures
```

1. 동일 계층 간 참조 금지 — 같은 계층의 서비스끼리 서로를 알지 못한다
2. 상위 계층만 하위 계층을 참조 가능
3. 하위 계층은 상위 계층을 알지 못한다

## Mono 레이어 제약

| 계층              | 참조 금지 대상                         |
| ----------------- | -------------------------------------- |
| `controllers`     | 없음                                   |
| `applications`    | `controllers`                          |
| `cores`           | `controllers`, `applications`          |
| `infrastructures` | `controllers`, `applications`, `cores` |

## MSA 레이어 제약

| 계층              | 참조 금지 대상                     |
| ----------------- | ---------------------------------- |
| `gateway`         | 없음                               |
| `applications`    | `gateway`                          |
| `cores`           | `gateway`, `applications`          |
| `infrastructures` | `gateway`, `applications`, `cores` |

## Application Service 설계

- 여러 Core Service를 조합해야 하는 경우에만 생성
- 단일 Core로 처리 가능한 API는 컨트롤러에서 Core Service 직접 호출
- 오케스트레이터 역할에 충실

## Import 규칙

- 직계 조상 폴더는 상대 경로로 import
- 직계 조상이 아닌 폴더는 절대 경로 사용
- 각 폴더에 `index.ts`(barrel export)로 공개 API 재수출

## 에러 객체

- `[Entity]Errors`는 서비스 디렉토리의 `errors.ts` 파일에 정의
- 서비스 클래스 파일 내 인라인 정의 금지
- `index.ts`에서 재수출: `export * from './errors'`
