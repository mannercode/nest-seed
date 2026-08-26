import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'
import { CreatePurchaseDto, PurchaseService } from 'application'
import { UserAuthGuard } from './guards'
import { IdempotencyKey } from './idempotency-key.decorator'
import { ParseIdempotencyKeyPipe } from './pipes'
import { UserAuthRequest } from './types'

@Controller('purchases')
export class PurchaseHttpController {
    constructor(private readonly purchaseService: PurchaseService) {}

    @Post()
    @UseGuards(UserAuthGuard)
    async processPurchase(
        @Body() createDto: CreatePurchaseDto,
        @IdempotencyKey(ParseIdempotencyKeyPipe) idempotencyKey: string,
        @Req() req: UserAuthRequest
    ) {
        return this.purchaseService.processPurchase(createDto, req.user.sub, idempotencyKey)
    }
}
