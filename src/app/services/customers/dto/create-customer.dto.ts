import { Type } from 'class-transformer'
import { IsDate, IsEmail, IsNotEmpty, IsString } from 'class-validator'

export class CreateCustomerDto {
    @IsString()
    @IsNotEmpty()
    name: string

    @IsEmail()
    email: string

    @IsDate()
    @Type(() => Date)
    birthdate: Date

    @IsString()
    password: string
}
