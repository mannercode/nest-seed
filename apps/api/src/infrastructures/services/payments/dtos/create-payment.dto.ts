import { IsNotEmpty, IsPositive, IsString } from 'class-validator'

export class CreatePaymentDto {
    @IsNotEmpty()
    @IsPositive()
    amount: number

    @IsNotEmpty()
    @IsString()
    customerId: string
}
