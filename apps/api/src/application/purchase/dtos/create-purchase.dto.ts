import { Type } from 'class-transformer'
import { IsArray, IsNotEmpty, IsPositive, IsString, ValidateNested } from 'class-validator'
import { PurchaseItemDto } from 'core'

export class CreatePurchaseDto {
    @IsNotEmpty()
    @IsString()
    userId: string

    @IsArray()
    @IsNotEmpty()
    @Type(() => PurchaseItemDto)
    @ValidateNested({ each: true })
    purchaseItems: PurchaseItemDto[]

    @IsNotEmpty()
    @IsPositive()
    totalPrice: number
}
