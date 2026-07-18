import { IsNotEmpty, IsString } from 'class-validator'

export class AdminRefreshTokenBodyDto {
    @IsNotEmpty()
    @IsString()
    refreshToken: string
}
