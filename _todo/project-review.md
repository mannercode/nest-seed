# 프로젝트 리뷰에서 남은 항목

## 진행 대상

### D1. 문서의 중복 설명과 소유 위치

- [ ] 사용 안내·보장·예외·선택 이유를 보존하면서 아래 중복을 정리한다.

- [영문 README](../README.en.md)는 현재 한글 원문과 구성이 다르며 계층도·폴더 트리·기술 목록을 상세 가이드와 별도로 유지한다. 한글 원문의 시작·사용·문서 안내 구조에 맞추되 영문에만 있는 필요한 사용 예시를 잃지 않게 한다.
- [개발 규칙](../docs/reference/conventions.md#타입과-변환)의 HTTP 테스트 예제·응답 변환 설명은 [libs](../docs/libs.md#4-json과-dto-복원)와 중복이다. 예제는 libs에만 두고 개발 규칙은 링크한다. `generateUuid` 래퍼의 이유도 libs와 [설계 결정](../docs/reference/decisions.md#nestjs와-모듈-경계)에 중복되어 있다.
- [apps](../docs/apps.md#통합-테스트와-실행-가능한-api-문서)의 teardown·rollback 테스트 작성 규칙과 [설계 결정](../docs/reference/decisions.md#검증의-강도와-의미)의 방어 분기·반복 CI 규칙은 conventions·tests가 이미 소유한다. apps의 인증 미구현 정책 목록도 설계 결정과 겹친다. 작성 규칙은 소유 문서에만 두고 현재 API 계약과 선택 이유는 유지한다.
- [infra](../docs/infra.md#4-restate-endpoint-연결)의 health와 workflow 등록 구분은 같은 문단에서 두 번 설명한다. [tests](../docs/tests.md)의 “복제본 수는 이 검증을 위한 선택이다”는 앞 설명에 정보를 더하지 않고, 브라우저 보고서 경로는 README와 중복이다. [tools](../docs/tools.md#2-dev-tools--명시적으로-실행하는-개발-도구)의 `free-port` listen 재확인 분기는 코드 대신 오류 계약·예외만 설명해도 된다.

영향: 같은 설명을 여러 곳에서 갱신해야 하고, 사용 조건·선택 이유와 구현 세부를 구분하기 어려워진다. 정리 후 원문과 대조해 고유한 정보가 남았는지 확인하고 format·문서 링크 검사를 실행한다. env 재생성, reset 삭제 범위, workflow 완료 경계, 배포 호환 조건과 구체적 예시는 보존한다.

## 보류

- [CacheService.withLockBlocking](../libs/common/src/cache/cache.service.ts): `waitMs: 10`, `pollMs: 40`에서 첫 획득 실패 후 두 번째 획득이 성공하면 40ms 이후 콜백을 실행한다. 가짜 Redis 응답으로 재현했으며 실제 Redis 지연 실험은 아니다. 엄격한 deadline인지 polling 대기 예산인지 계약을 더 명확히 할 수 있으나, 현재 취소·상호배제 훼손은 확인하지 않아 우선 수정 완료 조건에서 제외한다.
- [구매 중복 ticketIds](../apps/api/src/services/application/purchase/internal/ticket-purchase.service.ts): 같은 티켓을 중복 요청하면 결제 후 판매 건수 불일치로 거절·보상될 수 있다. 현재 판매 정합성과 보상은 유지되며, 잘못된 입력의 조기 거절 정책은 새 요구가 생길 때 검토한다.
