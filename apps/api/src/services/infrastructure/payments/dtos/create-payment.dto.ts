import { IsNotEmpty, IsPositive, IsString } from 'class-validator'

export class CreatePaymentDto {
    @IsNotEmpty()
    @IsPositive()
    amount: number

    @IsNotEmpty()
    @IsString()
    purchaseRecordId: string

    @IsNotEmpty()
    @IsString()
    userId: string
}
