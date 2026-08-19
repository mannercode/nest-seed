import { IsEmail, IsInt, IsOptional, IsString } from 'class-validator'

export class AdminAuthPayload {
    // 구 복제본이 발급한 claim 없는 토큰은 version 0으로만 호환한다.
    @IsInt()
    @IsOptional()
    authVersion?: number

    @IsString()
    sub: string

    @IsEmail()
    email: string
}
