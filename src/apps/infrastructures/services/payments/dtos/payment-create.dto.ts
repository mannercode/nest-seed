import { IsNotEmpty, IsPositive, IsString } from 'class-validator'
import { BaseDto } from 'common'

export class PaymentCreateDto extends BaseDto {
    @IsString()
    @IsNotEmpty()
    customerId: string

    @IsPositive()
    @IsNotEmpty()
    amount: number
}
