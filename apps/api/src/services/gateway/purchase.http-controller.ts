import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { CreatePurchaseDto, PurchaseService } from 'application'
import { PurchaseRecordsService } from 'core'

// AUTHZ: 시드는 인가 검사를 일부러 비워 둔다. 포크 시 `@UseGuards(UserJwtAuthGuard)` 를
// 걸고, body 의 userId 를 무시하고 `req.user.sub` 에서 가져오도록 변경하라
// (현재는 임의 사용자 명의로 결제 가능). README "5. 인가" 섹션 참고.
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
