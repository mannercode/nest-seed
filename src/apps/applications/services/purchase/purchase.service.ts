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
        const { ticketIds, showtimeIds } = await this.ticketProcessor.validatePurchase(createDto)

        let paymentId: string | null = null
        let purchaseId: string | null = null
        let ticketsUpdateAttempted = false

        try {
            const payment = await this.paymentsClient.create({
                customerId: createDto.customerId,
                amount: createDto.totalPrice
            })
            paymentId = payment.id

            const purchase = await this.purchaseRecordsClient.create({
                ...createDto,
                paymentId: payment.id
            })
            purchaseId = purchase.id

            ticketsUpdateAttempted = true
            await this.ticketProcessor.completePurchase(ticketIds)

            await this.ticketProcessor.releaseHolds(showtimeIds, createDto.customerId)

            try {
                await this.ticketProcessor.emitTicketPurchased(createDto.customerId, ticketIds)
            } catch (emitError) {
                // Ignore event failures to avoid rolling back a completed purchase.
            }

            return purchase
        } catch (error) {
            const compensations: Promise<unknown>[] = []

            if (ticketsUpdateAttempted) {
                compensations.push(this.ticketProcessor.rollbackPurchase(ticketIds))
                compensations.push(
                    this.ticketProcessor.emitTicketPurchaseCanceled(createDto.customerId, ticketIds)
                )
            }

            if (showtimeIds.length) {
                compensations.push(
                    this.ticketProcessor.releaseHolds(showtimeIds, createDto.customerId)
                )
            }

            if (purchaseId) {
                compensations.push(this.purchaseRecordsClient.deleteMany([purchaseId]))
            }

            if (paymentId) {
                compensations.push(this.paymentsClient.deleteMany([paymentId]))
            }

            if (compensations.length) {
                await Promise.allSettled(compensations)
            }

            throw error
        }
    }
}
