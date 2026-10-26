# 권한

현재 [Gateway](../apps/api/src/services/gateway/)는 사용자·관리자 guard와 token subject를 사용한다. 기존 역할과 자원 소유 관계를 검증하며, 토큰의 유효성·회수 시점은 [현재 인증 계약](../apps/README.md#http와-인증-계약)을 따른다.

## 서비스별 확장 보류

### R3. 관리자 역할 세분화·관리 기능

보류 이유: 시드는 단일 관리자 역할과 [독립 생성 스크립트](../apps/api/scripts/admin-create.cjs)를 제공하고 HTTP 관리자 생성·삭제는 제공하지 않는다. 모든 관리자가 같은 콘텐츠·사용자 관리 권한을 가지며, 역할 분리나 관리 화면을 요구하는 사용처는 정해지지 않았다.

재검토 조건: 실제 업무에서 관리자 역할을 나눠야 하면 허용 작업·생성·변경·회수 경로와 다른 관리자의 작업을 볼 범위를 정한다. 회수 효력은 [인증 A3](authentication.md)와 함께 결정한다. 클라이언트가 역할·주체를 입력해 권한을 얻지 못하고 상태·이벤트 조회가 정해진 범위를 따르는지 검증한다. 범용 RBAC·ABAC 엔진은 별도 요구가 있을 때 검토한다.

검증 위치: [users.spec.ts](../apps/api/src/__tests__/core/users.spec.ts), [admin-management.spec.ts](../apps/api/src/__tests__/core/admin-management.spec.ts), [인증 guard 테스트](../libs/common/src/auth/__tests__/guards.spec.ts), [상영 생성 테스트](../apps/api/src/__tests__/application/showtime-creation.spec.ts), [파일 연결 테스트](../apps/api/src/__tests__/core/movies-assets.spec.ts). 각 경로의 기존 spec에서 접근 경계를 검증한다.
