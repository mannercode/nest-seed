import { SetMetadata } from '@nestjs/common'

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth'

/**
 * 해당 라우트에 한해 `AuthGuard`를 optional로 동작시킨다.
 * `Authorization` 헤더가 없으면 `req.user = null`로 통과시키고,
 * 헤더가 있으면 평소대로 스킴 검증을 수행한다.
 *
 * 가드 인스턴스의 `optional` 옵션과는 OR로 결합된다.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true)
