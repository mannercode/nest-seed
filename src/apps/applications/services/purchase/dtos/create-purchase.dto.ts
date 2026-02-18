import { PurchaseItemDto } from 'apps/cores'
import { Type } from 'class-transformer'
import { IsArray, IsNotEmpty, IsPositive, IsString, ValidateNested } from 'class-validator'

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
