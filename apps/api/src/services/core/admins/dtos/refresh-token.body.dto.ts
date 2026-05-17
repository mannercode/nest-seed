import { IsNotEmpty, IsString } from 'class-validator'

// `POST /admins/refresh`와 `POST /admins/logout`가 함께 쓰는 본문이다.
// users 쪽 동일 DTO를 재사용하지 않는 이유는 도메인 경계(별도 모듈) 유지 때문이다.
export class AdminRefreshTokenBodyDto {
    @IsNotEmpty()
    @IsString()
    refreshToken: string
}
