import { Injectable } from '@nestjs/common'
import { PurchaseRecordsClient } from 'apps/cores'
import { PaymentsClient } from 'apps/infrastructures'
import { CreatePurchaseDto } from './dtos'
import { TicketPurchaseService } from './services'

@Injectable()
export class PurchaseService {
    constructor(
        private readonly purchaseRecordsClient: PurchaseRecordsClient,
        private readonly paymentsClient: PaymentsClient,
        private readonly ticketProcessor: TicketPurchaseService
    ) {}

    async processPurchase(createDto: CreatePurchaseDto) {
        const payment = await this.paymentsClient.create({
            customerId: createDto.customerId,
            amount: createDto.totalPrice
        })
        await this.ticketProcessor.validatePurchase(createDto)
        const purchaseRecord = await this.purchaseRecordsClient.create({
            ...createDto,
            paymentId: payment.id
        })
        try {
            await this.ticketProcessor.completePurchase(createDto)
            return purchaseRecord
        } catch (error) {
            await this.ticketProcessor.rollbackPurchase(createDto)
            throw error
        }
    }
}
