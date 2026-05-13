import { IsNotEmpty, IsString } from 'class-validator'

/**
 * `POST /users/refresh`와 `POST /users/logout`가 함께 쓰는 본문입니다.
 * 두 곳 모두 리프레시 토큰 한 필드만 받습니다.
 */
export class RefreshTokenBodyDto {
    @IsNotEmpty()
    @IsString()
    refreshToken: string
}
