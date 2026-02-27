import { Type } from 'class-transformer'
import { IsArray, IsNotEmpty, IsPositive, IsString, ValidateNested } from 'class-validator'
import { PurchaseItemDto } from './purchase-item.dto'

export class CreatePurchaseRecordDto {
    @IsNotEmpty()
    @IsString()
    customerId: string

    @IsNotEmpty()
    @IsString()
    paymentId: string

    @IsArray()
    @IsNotEmpty()
    @Type(() => PurchaseItemDto)
    @ValidateNested({ each: true })
    purchaseItems: PurchaseItemDto[]

    @IsNotEmpty()
    @IsPositive()
    totalPrice: number
}
