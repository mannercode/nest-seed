import { Injectable, Logger } from '@nestjs/common'
import { PurchaseRecordsService } from 'cores'
import { PaymentsService } from 'infrastructures'
import { CreatePurchaseDto } from './dtos'
import { TicketPurchaseService } from './services'

@Injectable()
export class PurchaseService {
    private readonly logger = new Logger(PurchaseService.name)

    constructor(
        private readonly purchaseRecordsService: PurchaseRecordsService,
        private readonly paymentsService: PaymentsService,
        private readonly ticketPurchaseService: TicketPurchaseService
    ) {}

    async processPurchase(createDto: CreatePurchaseDto) {
        this.logger.log('processPurchase', { customerId: createDto.customerId })

        await this.ticketPurchaseService.validatePurchase(createDto)

        const payment = await this.paymentsService.create({
            amount: createDto.totalPrice,
            customerId: createDto.customerId
        })
        this.logger.log('processPurchase createPayment completed', { paymentId: payment.id })

        let purchaseRecord
        try {
            purchaseRecord = await this.purchaseRecordsService.create({
                ...createDto,
                paymentId: payment.id
            })
            this.logger.log('processPurchase createPurchaseRecord completed', {
                purchaseRecordId: purchaseRecord.id
            })
        } catch (error) {
            this.logger.warn('processPurchase compensation: cancelPayment', {
                paymentId: payment.id
            })
            await this.paymentsService.cancel(payment.id)
            throw error
        }

        try {
            await this.ticketPurchaseService.completePurchase(createDto)
            this.logger.log('processPurchase completed', { purchaseRecordId: purchaseRecord.id })
            return purchaseRecord
        } catch (error) {
            this.logger.warn(
                'processPurchase compensation: rollbackPurchase, deletePurchaseRecord, cancelPayment',
                { paymentId: payment.id, purchaseRecordId: purchaseRecord.id }
            )
            await this.ticketPurchaseService.rollbackPurchase(createDto)
            await this.purchaseRecordsService.delete(purchaseRecord.id)
            await this.paymentsService.cancel(payment.id)
            throw error
        }
    }
}
