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
        private readonly ticketPurchaseService: TicketPurchaseService
    ) {}

    async processPurchase(createDto: CreatePurchaseDto) {
        await this.ticketPurchaseService.validatePurchase(createDto)

        const payment = await this.paymentsClient.create({
            amount: createDto.totalPrice,
            customerId: createDto.customerId
        })

        let purchaseRecord
        try {
            purchaseRecord = await this.purchaseRecordsClient.create({
                ...createDto,
                paymentId: payment.id
            })
        } catch (error) {
            await this.paymentsClient.cancel(payment.id)
            throw error
        }

        try {
            await this.ticketPurchaseService.completePurchase(createDto)
            return purchaseRecord
        } catch (error) {
            await this.ticketPurchaseService.rollbackPurchase(createDto)
            await this.purchaseRecordsClient.delete(purchaseRecord.id)
            await this.paymentsClient.cancel(payment.id)
            throw error
        }
    }
}
