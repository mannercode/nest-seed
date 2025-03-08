import { Injectable } from '@nestjs/common'
import { PurchaseCreateDto, PurchasesProxy } from 'cores'
import { TicketPurchaseProcessor } from './processors'

@Injectable()
export class PurchaseProcessService {
    constructor(
        private purchasesService: PurchasesProxy,
        private ticketProcessor: TicketPurchaseProcessor
    ) {}

    async processPurchase(createDto: PurchaseCreateDto) {
        await this.ticketProcessor.validatePurchase(createDto)

        const purchase = await this.purchasesService.createPurchase(createDto)

        try {
            await this.ticketProcessor.completePurchase(createDto)

            return purchase
        } catch (error) {
            await this.ticketProcessor.rollbackPurchase(createDto)
            throw error
        }
    }
}
