import { Type } from 'class-transformer'
import { IsArray, IsNotEmpty, IsPositive, IsString, ValidateNested } from 'class-validator'
import { BaseDto } from 'common'
import { PurchaseItemDto } from './purchase.dto'

export class PurchaseCreateDto extends BaseDto {
    @IsString()
    @IsNotEmpty()
    customerId: string

    @IsPositive()
    @IsNotEmpty()
    totalPrice: number

    @IsArray()
    @IsNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => PurchaseItemDto)
    items: PurchaseItemDto[]
}
