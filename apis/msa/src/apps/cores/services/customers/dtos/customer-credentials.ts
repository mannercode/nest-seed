import { IsEmail, IsString } from 'class-validator'

export class CustomerCredentialsDto {
    @IsEmail()
    email: string

    @IsString()
    password: string
}
