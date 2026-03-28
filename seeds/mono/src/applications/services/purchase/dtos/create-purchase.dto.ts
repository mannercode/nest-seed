import { Type } from 'class-transformer'
import { IsArray, IsNotEmpty, IsPositive, IsString, ValidateNested } from 'class-validator'
import { PurchaseItemDto } from 'cores'

export class CreatePurchaseDto {
    @IsNotEmpty()
    @IsString()
    customerId: string

    @IsArray()
    @IsNotEmpty()
    @Type(() => PurchaseItemDto)
    @ValidateNested({ each: true })
    purchaseItems: PurchaseItemDto[]

    @IsNotEmpty()
    @IsPositive()
    totalPrice: number
}
