import { IsEmail, IsString } from 'class-validator'

export class UserCredentialsDto {
    @IsEmail()
    email: string

    @IsString()
    password: string
}
