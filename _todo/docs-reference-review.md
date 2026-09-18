# 문서의 남은 검토 항목

아래 항목은 [현행 가이드](../README.md)에 반영한 수정 기준이다. 각 항목의 문서 링크는 검토 당시의 이전 가이드를 가리킨다. 미결 코드 작업과 전체 검토는 [통합 목록](project-review/README.md)을 따른다.

## 현재 코드와 설명을 맞출 항목

- [ ] **env 주입 방식:** [Dev Container의 환경 변수 설명](docsold/devcontainer.md#1-환경-변수는-재생성해야-반영된다)은 shell 실행기가 같은 파일을 읽는다고 설명한다. 현재는 Dev Container가 주입한 환경을 상속하고, API·web Compose의 서비스 env는 `format: raw`로 읽는다. `.env`를 Bash로 실행한다는 설명을 지우고 파일 변경 후 컨테이너 재생성이 필요하다는 계약은 유지한다.
- [ ] **MongoDB 트랜잭션 지원 범위:** [설계 결정 §5](docsold/reference/decisions.md#5-개발-환경-dev-container-단일-경로)의 “Replica Set에서만 동작”을 고친다. MongoDB는 Replica Set과 sharded cluster에서 다중 문서 트랜잭션을 지원한다. 프로젝트가 Replica Set을 선택했다는 설명이면 충분하다. [공식 문서](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
- [ ] **외부 테스트가 직접 확인하는 범위:** [tests 문서](docsold/tests.md)의 복제본 관측 설명을 좁힌다. `user-signup-race`·구매 race 일부는 전체 요청의 복제본 수를 검사하므로 같은 자원 그룹의 요청이 서로 다른 복제본에 갔다고 단정할 수 없다. `x-replica-id`도 HTTP 응답 복제본이며 Restate worker의 증거는 아니다. 가입 트래픽의 API kill/start와 별도 counter workflow의 Restate 서버 재시작을 구분해 적고, 구매·상영 실행 도중 API 종료까지 검증한 것으로 읽히지 않게 한다. 테스트·관측 장치를 추가하는 작업은 포함하지 않는다.

## 규칙과 선택 이유의 표현을 다듬을 항목

- [ ] **MongoDB 선택 이유:** [설계 결정 §7](docsold/reference/decisions.md#7-주-데이터베이스-mongodb)의 “cross-domain 외래 키·조인을 쓰지 않으므로 MongoDB가 맞는다”는 연결을 완화한다. 관계형 DB에서도 같은 서비스 경계는 가능하다. 현재 문서의 RDB 장점 설명은 유지하고, 이 시드의 문서 단위 모델과 공식 driver 사용을 프로젝트의 선택으로 설명한다. DB 교체나 비교 실험을 할 일로 만들지 않는다.
- [ ] **테스트 분리 기준:** [개발 규칙 §5](docsold/reference/conventions.md#5-테스트-문장은-조건과-결과를-이어-읽게-쓴다)의 응답·DB 반영 분리를 예외 없이 적용하는 규칙처럼 읽히지 않게 한다. 한 행동의 응답과 저장 결과를 함께 검증할 수 있고, 서로 독립적인 시나리오를 나눠야 한다는 취지로 다듬는다. 기존 테스트를 일괄 합치거나 나누지는 않는다.
- [ ] **type과 interface:** [개발 규칙 §2](docsold/reference/conventions.md#2-타입은-계약에-맞춰-고른다)는 언어 제약과 프로젝트 스타일을 구분한다. 객체 형태의 type alias도 클래스가 `implements`할 수 있음을 현재 TypeScript 6.0.3으로 다시 확인했다. `type`을 기본으로 쓰되 클래스 구현 계약에는 `interface`를 사용하기로 한 선택이라고 표현한다.
