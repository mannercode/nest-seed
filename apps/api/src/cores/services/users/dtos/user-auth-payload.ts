import { IsEmail, IsString } from 'class-validator'

export class UserAuthPayload {
    @IsString()
    userId: string

    @IsEmail()
    email: string
}
