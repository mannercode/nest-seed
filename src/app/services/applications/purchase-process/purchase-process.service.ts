import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'
import { PurchaseCreateDto, PurchasesService } from 'services/cores'
import { TicketPurchaseProcessor } from './processors'

@Injectable()
export class PurchaseProcessService {
    constructor(
        private purchasesService: PurchasesService,
        private ticketProcessor: TicketPurchaseProcessor
    ) {}

    @MethodLog()
    async processPurchase(createDto: PurchaseCreateDto) {
        await this.ticketProcessor.validatePurchase(createDto)

        const purchase = await this.purchasesService.createPurchase(createDto)

        try {
            await this.ticketProcessor.completePurchase(createDto)

            return purchase
        } catch (error) /* istanbul ignore next */ {
            await this.ticketProcessor.rollbackPurchase(createDto)
            throw error
        }
    }
}
