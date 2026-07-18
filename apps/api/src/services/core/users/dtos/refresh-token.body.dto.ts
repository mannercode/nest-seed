import { IsNotEmpty, IsString } from 'class-validator'

export class RefreshTokenBodyDto {
    @IsNotEmpty()
    @IsString()
    refreshToken: string
}
