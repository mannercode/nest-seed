import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { PurchaseProcessClient } from 'apps/applications'
import { CreatePurchaseDto, PurchasesClient } from 'apps/cores'

@Controller('purchases')
export class PurchasesController {
    constructor(
        private purchasesService: PurchasesClient,
        private purchaseProcessService: PurchaseProcessClient
    ) {}

    @Post()
    async processPurchase(@Body() createDto: CreatePurchaseDto) {
        return this.purchaseProcessService.processPurchase(createDto)
    }

    @Get(':purchaseId')
    async getPurchase(@Param('purchaseId') purchaseId: string) {
        const purchases = await this.purchasesService.getPurchases([purchaseId])
        return purchases[0]
    }
}

// TODO purchaseProcess -> purchases
// purchases -> purchaseRecords
