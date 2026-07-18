import { IsEmail, IsNotEmpty, IsString } from 'class-validator'

export class CreateAdminDto {
    @IsEmail()
    @IsNotEmpty()
    email: string

    @IsNotEmpty()
    @IsString()
    name: string

    @IsNotEmpty()
    @IsString()
    password: string
}
