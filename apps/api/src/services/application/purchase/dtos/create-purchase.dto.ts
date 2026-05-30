import { Type } from 'class-transformer'
import { IsArray, IsNotEmpty, IsPositive, ValidateNested } from 'class-validator'
import { PurchaseItemDto } from 'core'

// 결제자는 본문이 아니라 인증 토큰의 주체(req.user.sub)로 정한다.
// 본문에 userId를 두면 로그인 사용자가 타인 명의로 결제할 수 있으므로 받지 않는다.
export class CreatePurchaseDto {
    @IsArray()
    @IsNotEmpty()
    @Type(() => PurchaseItemDto)
    @ValidateNested({ each: true })
    purchaseItems: PurchaseItemDto[]

    @IsNotEmpty()
    @IsPositive()
    totalPrice: number
}
