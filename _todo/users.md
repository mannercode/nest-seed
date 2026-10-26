# 사용자 관리

현재 [사용자 서비스](../apps/api/src/services/core/users/users.service.ts)는 생성·조회·수정·탈퇴를 제공한다. 삭제는 soft delete이며 같은 이메일로 재가입할 수 있다. 기존 토큰·세션의 효력은 [현재 인증 계약](../apps/README.md#http와-인증-계약)을 따른다.

## 예제 설명 정리

### U1. 예제의 가입 조건 설명

- [ ] 이름·생년월일이 이 예제의 가입 조건임을 앱 가이드에 설명한다.

근거: [생성 DTO](../apps/api/src/services/core/users/dtos/create-user.dto.ts)는 이메일·비밀번호 외에 이름과 생년월일을 필수로 요구한다. 이 선택을 모든 서비스의 공통 계정 요건으로 해석하지 않도록 예제의 범위를 설명할 필요가 있다.

최소 범위: 현재 DTO·가입 화면의 필수 조건을 유지하고, 포크한 서비스가 사용 목적에 따라 바꿀 부분임을 설명한다. 범용 계정 모델·사용자 속성 저장소나 별도 프로필 계층을 만들지 않는다.

검증: 설명이 현재 생성 DTO·가입 화면의 입력과 일치하는지 확인한다.

## 서비스별 확장 보류

### U3. 이메일 확인과 이메일 변경

보류 이유: [현재 모델](../apps/api/src/services/core/users/models/user.ts)에는 이메일 확인 상태가 없으며 `PATCH /users/me`로 이메일을 바로 변경한다. 확인 필수 여부와 미확인 계정의 허용 범위는 서비스 정책이며, 실제 메일 발송 수단도 필요하다.

재검토 조건: 이메일 소유 확인이 필요한 사용처가 생기면 새 주소 확인 전 기존 주소 유지 여부·재인증과 확인 토큰의 만료·일회성·재발송 처리를 정한다. [인증 A5](authentication.md)와 발송 수단을 함께 검토하고, 만료·재사용·동시 확인·이메일 중복·발송 실패 및 확인 전후의 로그인·접근 범위를 검증한다.

### U4. 계정 정지·탈퇴와 관련 데이터

보류 이유: 현재 `deletedAt`으로 활성·삭제를 구분하고 탈퇴 시 soft delete와 refresh 세션 회수를 수행한다. 별도 정지 상태나 구매 기록 등 관련 데이터의 삭제는 제공하지 않는다. 정지·보존 기간·연관 데이터 처리는 실제 서비스의 업무와 보관 요건에 따라 달라진다.

재검토 조건: 정지·해제나 탈퇴 후 데이터 처리가 필요하면 본인·관리자 권한, 진행 중인 업무·소유 파일, 탈퇴 재요청·재가입 결과를 정한다. [인증 A3](authentication.md)의 효력 시점과 [권한 정책](authorization.md)의 자원 인가, [파일 정책](files.md)의 삭제·정리를 함께 검토한다. 중간 실패·재요청으로 타인 데이터가 삭제되지 않고 상태 변경 후 로그인·갱신·조회가 정해진 결과를 반환하는지 확인한다.

검증 위치: [users.spec.ts](../apps/api/src/__tests__/core/users.spec.ts), [user-auth.spec.ts](../apps/api/src/__tests__/core/user-auth.spec.ts), [admin-management.spec.ts](../apps/api/src/__tests__/core/admin-management.spec.ts), [사용자 브라우저 흐름](../tests/web/e2e/user-auth-flow.spec.ts).
