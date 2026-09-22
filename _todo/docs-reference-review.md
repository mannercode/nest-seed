# 문서 검토 반영 결과

아래 항목은 모두 현행 가이드에 반영됐다. 링크는 반영된 설명을 가리키며, 미결 코드 작업은 [통합 목록](project-review/README.md)을 따른다.

## 구현과 설명의 일치

- [x] **env 주입 방식:** [Dev Container](../docs/devcontainer.md#1-환경-변수는-재생성해야-반영된다)에 생성 시 주입·환경 상속·변경 후 재생성과 Compose의 `format: raw`를 명시했다. 루트 env 파일을 shell로 다시 읽는다고 설명하지 않는다.
- [x] **MongoDB 트랜잭션 지원 범위:** [설계 결정](../docs/reference/decisions.md#mongodb와-원자성)에 Replica Set과 sharded cluster의 지원을 명시하고 이 시드의 topology 선택과 구분했다.
- [x] **외부 테스트의 관측 범위:** [tests](../docs/tests.md#race의-관측-범위)에 반복 전체의 복제본 관측과 충돌 키별 분산을 구분했다. `x-replica-id`는 HTTP 응답 복제본이며, 가입 중 API 재시작과 Restate 서버 journal 복구는 서로 다른 검증이다. 구매·상영 실행 중 소유 프로세스 종료까지 검증했다고 설명하지 않는다.

## 규칙과 선택 이유

- [x] **MongoDB 선택 이유:** [설계 결정](../docs/reference/decisions.md#mongodb와-원자성)은 문서 단위 모델과 공식 driver 사용을 프로젝트의 선택으로 설명한다. 관계형 DB에서도 같은 서비스 경계가 가능하며 DB 교체·비교 실험을 새 작업으로 만들지 않는다.
- [x] **테스트 분리 기준:** [개발 규칙](../docs/reference/conventions.md#테스트는-한-행동의-결과를-검증한다)은 한 행동의 응답과 저장 결과를 함께 검증할 수 있게 한다. 독립 시나리오를 구분하는 기준이며 기존 테스트를 기계적으로 합치거나 나누라는 뜻이 아니다.
- [x] **type과 interface:** [개발 규칙](../docs/reference/conventions.md#타입과-변환)은 `type` 기본·클래스 구현 계약의 `interface`를 프로젝트 스타일로 설명한다. 객체 형태의 type alias도 `implements`할 수 있음을 명시했다.
