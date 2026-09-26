# 권한

현재 [Gateway](../apps/api/src/services/gateway/)는 사용자·관리자 guard와 token subject를 사용한다. 별도 권한 엔진이나 역할 관리 모델은 없다. 토큰의 유효성·회수 시점은 [인증](authentication.md), 사용자 상태는 [사용자 U4](users.md)가 소유한다.

## 검증 우선

### R1. 공개·사용자·관리자 경로의 접근 계약

- [ ] Gateway의 HTTP·SSE 경로를 공개·선택 인증·사용자·관리자로 대조하고 빠진 접근 경계 테스트와 guard 적용을 보완한다.

근거: 현재 클래스·메서드에 guard를 직접 지정한다. [UsersHttpController](../apps/api/src/services/gateway/users.http-controller.ts)처럼 공개 가입·로그인, 본인 자원, 관리자 경로가 함께 있는 컨트롤러도 있다.

최소 범위: 기존 라우트와 테스트를 대조해 누락된 경계만 보완한다. BFF를 거치지 않은 직접 API 호출도 대상으로 한다. 현재 역할 불일치의 401, 타인 작업 조회의 404를 단순 정리 목적으로 바꾸지 않는다.

검증: 미인증·정상 역할·다른 역할·잘못된 토큰의 허용 여부를 확인한다. 선택 인증 경로는 토큰이 없는 요청과 잘못된 토큰을 보낸 요청을 구분한다. 거절된 변경 요청에는 DB·파일·외부 효과가 남지 않는다.

### R2. 자원 소유자와 계정 상태의 적용

- [ ] 본인 자원·목록·파일·작업 조회의 식별자 출처를 점검하고, 확정한 계정 상태·파일 접근 정책을 적용한다.

근거: `/me`와 구매 주체는 token subject로 결정하고 작업 상태는 접수 주체를 확인한다. 파일은 사용자 ID가 아니라 `ownerService + ownerEntityId`로 연결되므로 파일의 소유 대상과 요청자의 접근 권한을 함께 판단해야 한다.

최소 범위: URL·본문·검색 조건에 타인 ID를 넣어도 자기 권한이 넓어지지 않는지 확인한다. 역할 검사는 Gateway, 대상 자원의 접근 조건은 이를 소유하는 서비스 경계에서 처리한다. 계정 상태 차단 시점은 인증 A3, 파일 접근은 [파일 F1](files.md)의 결정에 따른다.

검증: 두 사용자·두 관리자를 구분해 단건·목록·상태 조회와 변경을 확인한다. 사용자 소유 파일을 도입하면 타인의 업로드를 확정·조회·삭제하지 못하고 거절 후 소유 관계가 그대로인지 확인한다.

## 결정 필요

### R3. 관리자 권한과 작업 조회 범위

- [ ] 현재 단일 관리자 역할을 유지할지, 역할을 나눌 실제 업무가 있는지 정하고 관리자 생성·변경·회수 경로를 명시한다.

근거: 최초 관리자는 [독립 스크립트](../apps/api/scripts/admin-create.cjs)로 생성하고 HTTP 생성·삭제는 제공하지 않는다. 모든 관리자가 같은 콘텐츠·사용자 관리 권한을 가진다. [상영 생성 컨트롤러](../apps/api/src/services/gateway/showtime-creation.http-controller.ts)의 상태 조회는 접수 주체별이지만 SSE는 관리자에게 전체 진행 이벤트를 전달한다.

최소 범위: 역할 분리가 필요하면 실제 업무와 허용 작업부터 정한다. 관리자가 서로의 작업을 볼 수 있는지 결정해 상태 조회·이벤트 전달을 일치시키거나 차이의 목적을 설명한다. 관리자 회수의 효력은 인증 A3와 연결한다. 범용 RBAC·ABAC 엔진이나 관리 화면은 이 결정 없이 추가하지 않는다.

검증: 클라이언트가 역할·주체를 입력해 권한을 얻지 못한다. 다른 관리자의 상태·이벤트 접근과 관리자 권한 회수가 결정한 범위를 따른다.

검증 위치: [users.spec.ts](../apps/api/src/__tests__/core/users.spec.ts), [admin-management.spec.ts](../apps/api/src/__tests__/core/admin-management.spec.ts), [인증 guard 테스트](../libs/common/src/auth/__tests__/guards.spec.ts), [상영 생성 테스트](../apps/api/src/__tests__/application/showtime-creation.spec.ts), [파일 연결 테스트](../apps/api/src/__tests__/core/movies-assets.spec.ts). 각 경로의 기존 spec에서 접근 경계를 검증한다.
