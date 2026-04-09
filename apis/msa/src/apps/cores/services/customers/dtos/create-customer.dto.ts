import { Type } from 'class-transformer'
import { IsDate, IsEmail, IsNotEmpty, IsString } from 'class-validator'

export class CreateCustomerDto {
    @IsDate()
    @Type(() => Date)
    birthDate: Date

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
