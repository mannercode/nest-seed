import { Injectable } from '@nestjs/common'
import { CreatePurchaseRecordDto, PurchaseRecordsClient } from 'apps/cores'
import { TicketPurchaseProcessor } from './processors'

@Injectable()
export class PurchaseProcessService {
    constructor(
        private purchasesService: PurchaseRecordsClient,
        private ticketProcessor: TicketPurchaseProcessor
    ) {}

    async processPurchase(createDto: CreatePurchaseRecordDto) {
        // const payment = await this.paymentsService.createPayment({
        //     customerId: createDto.customerId,
        //     amount: createDto.totalPrice
        // })
        // await this.ticketProcessor.validatePurchase(createDto)
        // const purchase = await this.purchasesService.createPurchseRecord({
        //     ...createDto,
        //     paymentId: payment.id
        // })
        // try {
        //     await this.ticketProcessor.completePurchase(createDto)
        //     return purchase
        // } catch (error) {
        //     await this.ticketProcessor.rollbackPurchase(createDto)
        //     throw error
        // }
    }
}
