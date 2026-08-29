import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'
import { CreatePurchaseSchema, PurchaseService, type CreatePurchaseDto } from '#application'
import type { UserAuthRequest } from './types.js'
import { UserAuthGuard } from './guards/index.js'
import { IdempotencyKey } from './idempotency-key.decorator.js'
import { ParseIdempotencyKeyPipe } from './pipes/index.js'

@Controller('purchases')
export class PurchaseHttpController {
    constructor(private readonly purchaseService: PurchaseService) {}

    @Post()
    @UseGuards(UserAuthGuard)
    async processPurchase(
        @Body({ schema: CreatePurchaseSchema }) createDto: CreatePurchaseDto,
        @IdempotencyKey(ParseIdempotencyKeyPipe) idempotencyKey: string,
        @Req() req: UserAuthRequest
    ) {
        return this.purchaseService.processPurchase(createDto, req.user.sub, idempotencyKey)
    }
}
