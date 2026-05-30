import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'
import { CreatePurchaseDto, PurchaseService } from 'application'
import { UserAuthGuard } from './guards'
import { UserAuthRequest } from './types'

// 인가: 결제자는 본문이 아니라 인증 토큰의 주체(req.user.sub)로 정한다.
// 본문에 userId를 두면 로그인 사용자가 타인 명의로 결제할 수 있으므로 CreatePurchaseDto는 userId를 받지 않는다.
// 본인 구매 기록 조회는 소유자 컨텍스트가 경로에 드러나는 GET /users/me/purchases 로 옮겼다.
@Controller('purchases')
export class PurchaseHttpController {
    constructor(private readonly purchaseService: PurchaseService) {}

    @Post()
    @UseGuards(UserAuthGuard)
    async processPurchase(@Body() createDto: CreatePurchaseDto, @Req() req: UserAuthRequest) {
        return this.purchaseService.processPurchase(createDto, req.user.sub)
    }
}
