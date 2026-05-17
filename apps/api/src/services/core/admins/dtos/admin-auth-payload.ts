import { IsEmail, IsString } from 'class-validator'

export class AdminAuthPayload {
    @IsString()
    sub: string

    @IsEmail()
    email: string
}
