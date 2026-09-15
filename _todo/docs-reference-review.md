# docs/reference 검토

`conventions.md`의 개발 약속과 `decisions.md`의 선택 이유·보장 한계를 나눈 구성은 유지할 가치가 있다. 외부 연동의 공통 경계, DB 정합성과 Redis 락의 역할, 메시지 중복과 구매 복구의 한계도 필요한 내용이다. 아래는 기술적 오류와 적용 범위를 재검토할 제안이며, 현행 지침을 대체하지 않는다.

## 1. 네이밍 규칙의 적용 범위

[개발 규칙 §1](../docs/reference/conventions.md#1-서비스와-메서드-이름)의 조건 나열 금지를 업무 계약까지 지우는 규칙으로 적용하지 않는다.

제안 문구:

> 같은 동작을 조회 조건별 메서드로 늘리지 않는다. 조건은 객체 인자로 받는다. 업무 목적·반환 결과·실패 계약이 다른 동작은 이름으로 구분한다.

`findForAuthentication`은 인증용 계정 조회, `getPublished`는 미공개 영화의 404 처리를 드러낸다. `findReconciliationCandidates`는 pending뿐 아니라 lease가 만료된 진행 중 구매도 포함하는 복구 대상을 뜻한다. 이를 모두 일반 조회 하나로 합칠 이유는 없다.

## 2. 단건 조회·삭제까지 일괄 API로 강제할지

[개발 규칙 §1](../docs/reference/conventions.md#1-서비스와-메서드-이름)은 미래의 일괄 처리를 위해 조회·삭제를 처음부터 `getMany`·`deleteMany`로 제공하도록 한다. 프로젝트의 선택으로는 가능하지만, 항상 더 좋은 설계라는 근거는 부족하다.

단건과 다건은 누락 대상 처리·반환 순서·부분 성공의 계약이 다르다. 실제 일괄 처리가 필요할 때 도입하는 쪽을 권하며, 이 제안만으로 현재 API 계약을 바꾸지는 않는다.

## 3. MongoDB 트랜잭션 지원 범위

[설계 결정 §5](../docs/reference/decisions.md#5-개발-환경-dev-container-단일-경로)의 “Replica Set에서만 동작”은 부정확하다. 다중 문서 트랜잭션은 Replica Set과 sharded cluster에서 지원하며 standalone에서는 지원하지 않는다.

“이 프로젝트는 트랜잭션을 위해 Replica Set으로 구성한다”로 수정할 수 있다. [MongoDB 공식 문서](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)

## 4. MongoDB 선택의 근거

[설계 결정 §7](../docs/reference/decisions.md#7-주-데이터베이스-mongodb)에서 도메인 간 외래 키·조인을 사용하지 않는다는 결정만으로 MongoDB의 적합성이 입증되지는 않는다. 관계형 DB도 같은 서비스 경계를 유지할 수 있다.

현재 문서도 관계형 DB의 제약·트랜잭션·인덱스 장점은 인정한다. 그 설명은 유지하고, MongoDB 선택의 근거를 실제 문서 단위 저장·조회 모델에 맞춰 보완한다.

## 5. 응답과 저장 결과의 테스트 분리

[개발 규칙 §5](../docs/reference/conventions.md#5-테스트-문장은-조건과-결과를-이어-읽게-쓴다)의 응답과 DB 반영 분리를 기계적으로 강제하면 하나의 행동을 불필요하게 여러 번 실행하게 된다.

“생성이 성공하고 실제로 저장된다”는 하나의 계약을 같은 테스트에서 검증할 수 있다. 이미 명시한 복합 불변식 예외를 더 분명히 하고, 서로 독립적인 실패 의미를 가진 행동인지에 따라 분리하도록 다듬는다.

## 6. type과 interface는 스타일 선택임을 명시

[개발 규칙 §2](../docs/reference/conventions.md#2-타입은-계약에-맞춰-고른다)의 `type` 우선 사용은 유효한 스타일이다. 다만 객체 형태의 type alias도 클래스가 `implements`할 수 있으며, 저장소의 TypeScript 6.0.3으로 확인했다.

“클래스 구현 계약에는 interface를 사용하기로 한다”라고 표현하면 언어의 필수 제약으로 오해하지 않는다.
