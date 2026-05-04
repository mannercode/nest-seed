import { IsEmail, IsString } from 'class-validator'

export class UserAuthPayload {
    @IsString()
    sub: string

    @IsEmail()
    email: string
}
