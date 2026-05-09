import { IsNotEmpty, IsString } from 'class-validator'

// `POST /users/refresh` 와 `POST /users/logout` 가 공유하는 HTTP body.
// 둘 다 `{ refreshToken }` 한 필드만 받는다.
export class RefreshTokenBodyDto {
    @IsNotEmpty()
    @IsString()
    refreshToken: string
}
