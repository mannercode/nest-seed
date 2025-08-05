import { Injectable } from '@nestjs/common'
import { PurchaseRecordsClient } from 'apps/cores'
import { PaymentsClient } from 'apps/infrastructures'
import { CreatePurchaseDto } from './dtos'
import { TicketPurchasService } from './services'

@Injectable()
export class PurchaseService {
    constructor(
        private purchasesService: PurchaseRecordsClient,
        private paymentsService: PaymentsClient,
        private ticketProcessor: TicketPurchasService
    ) {}

    async processPurchase(createDto: CreatePurchaseDto) {
        const payment = await this.paymentsService.createPayment({
            customerId: createDto.customerId,
            amount: createDto.totalPrice
        })
        await this.ticketProcessor.validatePurchase(createDto)
        const purchase = await this.purchasesService.createPurchseRecord({
            ...createDto,
            paymentId: payment.id
        })
        try {
            await this.ticketProcessor.completePurchase(createDto)
            return purchase
        } catch (error) {
            await this.ticketProcessor.rollbackPurchase(createDto)
            throw error
        }
    }
}
