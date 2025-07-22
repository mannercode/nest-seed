import { IsEmail, IsString } from 'class-validator'

export class CustomerCredentials {
    @IsEmail()
    email: string

    @IsString()
    password: string
}
