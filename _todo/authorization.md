# 권한

현재 [Gateway](../apps/api/src/services/gateway/)는 사용자·관리자 guard와 token subject를 사용한다. 기존 역할과 자원 소유 관계를 검증하며, 토큰의 유효성·회수 시점은 [현재 인증 계약](../apps/README.md#http와-인증-계약)을 따른다.

## 기존 기능 검증·수정

### R1. 공개·사용자·관리자 경로의 접근 계약

- [ ] Gateway의 HTTP·SSE 경로를 공개·선택 인증·사용자·관리자로 대조하고 빠진 접근 경계 테스트와 guard 적용을 보완한다.

근거: 현재 클래스·메서드에 guard를 직접 지정한다. [UsersHttpController](../apps/api/src/services/gateway/users.http-controller.ts)처럼 공개 가입·로그인, 본인 자원, 관리자 경로가 함께 있는 컨트롤러도 있다.

최소 범위: 기존 라우트와 테스트를 대조해 누락된 경계만 보완한다. BFF를 거치지 않은 직접 API 호출도 대상으로 한다. 현재 역할 불일치의 401, 타인 작업 조회의 404를 단순 정리 목적으로 바꾸지 않는다.

검증: 미인증·정상 역할·다른 역할·잘못된 토큰의 허용 여부를 확인한다. 선택 인증 경로는 토큰이 없는 요청과 잘못된 토큰을 보낸 요청을 구분한다. 거절된 변경 요청에는 DB·파일·외부 효과가 남지 않는다.

### R2. 기존 자원 소유자와 작업 조회 권한

- [ ] 현재 본인 자원·목록·영화 파일·작업 조회의 식별자 출처와 허용 범위를 점검하고 기존 인가가 빠진 부분을 보완한다.

근거: `/me`와 구매 주체는 token subject로 결정하고 작업 상태는 접수 주체를 확인한다. 파일은 `ownerService + ownerEntityId`로 연결되므로 소유 대상과 요청자의 권한을 함께 판단해야 한다. [상영 생성](../apps/api/src/services/gateway/showtime-creation.http-controller.ts)의 상태 조회는 접수 주체별이지만 SSE는 관리자에게 전체 진행 이벤트를 전달하므로, 이 차이가 현재 의도와 맞는지 확인할 필요가 있다.

최소 범위: URL·본문·검색 조건에 타인 ID를 넣어도 현재 허용된 권한이 넓어지지 않는지 확인한다. 역할은 Gateway에서, 대상 자원에 대한 권한은 해당 서비스에서 검사한다. 상태 조회·SSE의 허용 범위와 차이의 목적을 대조하되 새 역할·계정 정지·비공개 파일을 도입하지 않는다. 기존 계약의 의도를 확정할 수 없으면 정책 결정 항목으로 구분한다.

검증: 두 사용자·두 관리자를 구분해 현재 단건·목록·작업 상태·SSE 조회와 변경을 확인한다. 거절된 영화 파일 요청이 소유 관계·DB 상태를 바꾸거나 외부 작업을 실행하지 않는지 확인한다. 삭제된 계정의 액세스 토큰은 현재 5분 유효 계약을 기준으로 판단한다.

## 서비스별 확장 보류

### R3. 관리자 역할 세분화·관리 기능

보류 이유: 시드는 단일 관리자 역할과 [독립 생성 스크립트](../apps/api/scripts/admin-create.cjs)를 제공하고 HTTP 관리자 생성·삭제는 제공하지 않는다. 모든 관리자가 같은 콘텐츠·사용자 관리 권한을 가지며, 역할 분리나 관리 화면을 요구하는 사용처는 정해지지 않았다. 기존 작업 조회·SSE의 권한 검증은 R2에서 진행한다.

재검토 조건: 실제 업무에서 관리자 역할을 나눠야 하면 허용 작업·생성·변경·회수 경로와 다른 관리자의 작업을 볼 범위를 정한다. 회수 효력은 [인증 A3](authentication.md)와 함께 결정한다. 클라이언트가 역할·주체를 입력해 권한을 얻지 못하고 상태·이벤트 조회가 정해진 범위를 따르는지 검증한다. 범용 RBAC·ABAC 엔진은 별도 요구가 있을 때 검토한다.

검증 위치: [users.spec.ts](../apps/api/src/__tests__/core/users.spec.ts), [admin-management.spec.ts](../apps/api/src/__tests__/core/admin-management.spec.ts), [인증 guard 테스트](../libs/common/src/auth/__tests__/guards.spec.ts), [상영 생성 테스트](../apps/api/src/__tests__/application/showtime-creation.spec.ts), [파일 연결 테스트](../apps/api/src/__tests__/core/movies-assets.spec.ts). 각 경로의 기존 spec에서 접근 경계를 검증한다.
