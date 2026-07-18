import { Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsPositive, ValidateNested } from 'class-validator'
import { PurchaseItemDto } from 'core'

export class CreatePurchaseDto {
    // `@IsNotEmpty()`는 빈 배열을 통과시키므로 배열 전용 검증을 쓴다.
    @ArrayNotEmpty()
    @IsArray()
    @Type(() => PurchaseItemDto)
    @ValidateNested({ each: true })
    purchaseItems: PurchaseItemDto[]

    @IsNotEmpty()
    @IsPositive()
    totalPrice: number
}
