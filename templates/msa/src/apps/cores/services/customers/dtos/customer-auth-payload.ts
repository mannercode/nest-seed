import { IsEmail, IsString } from 'class-validator'

export class CustomerAuthPayload {
    @IsString()
    customerId: string

    @IsEmail()
    email: string
}
