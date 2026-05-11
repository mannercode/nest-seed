import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { CreatePurchaseDto, PurchaseService } from 'application'
import { PurchaseRecordsService } from 'core'

// 인가: 이 컨트롤러도 인가 검사를 비워 둡니다. 지금은 본문에 들어오는 어떤
// 사용자 ID로도 결제가 가능합니다. 포크해서 쓸 때는
// `@UseGuards(UserJwtAuthGuard)`를 걸고, 본문의 사용자 ID를 무시한 뒤
// `req.user.sub`에서 가져오도록 바꿉니다. 자세한 안내는 README "5. 인가"
// 절에 있습니다.
@Controller('purchases')
export class PurchaseHttpController {
    constructor(
        private readonly purchaseRecordsService: PurchaseRecordsService,
        private readonly purchaseService: PurchaseService
    ) {}

    @Get(':purchaseRecordId')
    async getPurchaseRecord(@Param('purchaseRecordId') purchaseRecordId: string) {
        const [purchaseRecord] = await this.purchaseRecordsService.getMany([purchaseRecordId])
        return purchaseRecord
    }

    @Post()
    async processPurchase(@Body() createDto: CreatePurchaseDto) {
        return this.purchaseService.processPurchase(createDto)
    }
}
