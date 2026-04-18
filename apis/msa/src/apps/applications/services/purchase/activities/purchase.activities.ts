import type { CreatePurchaseRecordDto, PurchaseRecordDto, PurchaseRecordsClient } from 'cores'
import type { PaymentsClient } from 'infrastructures'
import { HttpException } from '@nestjs/common'
import { log, ApplicationFailure } from '@temporalio/activity'
import type { CreatePurchaseDto } from '../dtos'
import type { TicketPurchaseService } from '../services'

export interface PurchaseActivities {
    validatePurchase(createDto: CreatePurchaseDto): Promise<void>
    createPayment(amount: number, customerId: string): Promise<{ id: string }>
    createPurchaseRecord(createDto: CreatePurchaseRecordDto): Promise<PurchaseRecordDto>
    completePurchase(createDto: CreatePurchaseDto): Promise<void>
    cancelPayment(paymentId: string): Promise<void>
    deletePurchaseRecord(purchaseRecordId: string): Promise<void>
    rollbackPurchase(createDto: CreatePurchaseDto): Promise<void>
}

function rethrowAsApplicationFailure(error: unknown): never {
    if (error instanceof HttpException) {
        throw ApplicationFailure.nonRetryable(
            JSON.stringify({ status: error.getStatus(), response: error.getResponse() }),
            'HttpException'
        )
    }
    throw error
}

export function createPurchaseActivities(deps: {
    ticketPurchaseService: TicketPurchaseService
    paymentsClient: PaymentsClient
    purchaseRecordsClient: PurchaseRecordsClient
}): PurchaseActivities {
    return {
        async validatePurchase(createDto) {
            log.info('validatePurchase', { customerId: createDto.customerId })
            try {
                await deps.ticketPurchaseService.validatePurchase(createDto)
            } catch (error) {
                rethrowAsApplicationFailure(error)
            }
        },

        async createPayment(amount, customerId) {
            log.info('createPayment', { amount, customerId })
            const payment = await deps.paymentsClient.create({ amount, customerId })
            return { id: payment.id }
        },

        async createPurchaseRecord(createDto) {
            log.info('createPurchaseRecord', { customerId: createDto.customerId })
            return deps.purchaseRecordsClient.create(createDto)
        },

        async completePurchase(createDto) {
            log.info('completePurchase', { customerId: createDto.customerId })
            try {
                await deps.ticketPurchaseService.completePurchase(createDto)
            } catch (error) {
                rethrowAsApplicationFailure(error)
            }
        },

        async cancelPayment(paymentId) {
            log.warn('cancelPayment', { paymentId })
            await deps.paymentsClient.cancel(paymentId)
        },

        async deletePurchaseRecord(purchaseRecordId) {
            log.warn('deletePurchaseRecord', { purchaseRecordId })
            await deps.purchaseRecordsClient.delete(purchaseRecordId)
        },

        async rollbackPurchase(createDto) {
            log.warn('rollbackPurchase', { customerId: createDto.customerId })
            await deps.ticketPurchaseService.rollbackPurchase(createDto)
        }
    }
}
