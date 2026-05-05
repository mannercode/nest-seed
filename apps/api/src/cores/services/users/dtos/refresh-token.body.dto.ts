import { IsNotEmpty, IsString } from 'class-validator'

// HTTP body for `POST /users/refresh` 와 `POST /users/logout` 공유.
// 둘 다 `{ refreshToken }` 한 필드만 받는다.
export class RefreshTokenBodyDto {
    @IsNotEmpty()
    @IsString()
    refreshToken: string
}
