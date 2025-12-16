import { Injectable } from '@nestjs/common'
import { PurchaseRecordsClient } from 'apps/cores'
import { PaymentsClient } from 'apps/infrastructures'
import { CreatePurchaseDto } from './dtos'
import { TicketPurchaseService } from './services'

@Injectable()
export class PurchaseService {
    constructor(
        private readonly purchasesService: PurchaseRecordsClient,
        private readonly paymentsService: PaymentsClient,
        private readonly ticketProcessor: TicketPurchaseService
    ) {}

    async processPurchase(createDto: CreatePurchaseDto) {
        const payment = await this.paymentsService.create({
            customerId: createDto.customerId,
            amount: createDto.totalPrice
        })
        await this.ticketProcessor.validatePurchase(createDto)
        const purchase = await this.purchasesService.create({ ...createDto, paymentId: payment.id })
        try {
            await this.ticketProcessor.completePurchase(createDto)
            return purchase
        } catch (error) {
            await this.ticketProcessor.rollbackPurchase(createDto)
            throw error
        }
    }
}
