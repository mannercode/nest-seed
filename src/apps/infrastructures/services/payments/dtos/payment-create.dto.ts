import { IsNotEmpty, IsPositive, IsString } from 'class-validator'

export class PaymentCreateDto {
    @IsString()
    @IsNotEmpty()
    customerId: string

    @IsPositive()
    @IsNotEmpty()
    amount: number
}
