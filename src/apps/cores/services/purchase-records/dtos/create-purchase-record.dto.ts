import { Type } from 'class-transformer'
import { IsArray, IsNotEmpty, IsPositive, IsString, ValidateNested } from 'class-validator'
import { PurchaseItemDto } from './purchase-record.dto'

export class CreatePurchaseRecordDto {
    @IsString()
    @IsNotEmpty()
    customerId: string

    @IsString()
    @IsNotEmpty()
    paymentId: string

    @IsPositive()
    @IsNotEmpty()
    totalPrice: number

    @IsArray()
    @IsNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => PurchaseItemDto)
    purchaseItems: PurchaseItemDto[]
}
