import { SetMetadata } from '@nestjs/common'

// 기본적으로 AdminAuthGuard는 root sub를 403으로 거부한다(콘텐츠 endpoint는 admin 전용).
// 다만 `/admins/me`처럼 root를 통과시키되 컨트롤러 안에서 별도 처리(예: NotFoundException)가
// 필요한 라우트에는 이 데코레이터를 붙여 root를 허용한다.
export const ADMIN_AUTH_ALLOW_ROOT = 'admin-auth:allow-root'
export const AllowRoot = () => SetMetadata(ADMIN_AUTH_ALLOW_ROOT, true)
