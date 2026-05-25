import { IsEmail, IsString } from 'class-validator'

export class AdminCredentialsDto {
    @IsEmail()
    email: string

    @IsString()
    password: string
}
