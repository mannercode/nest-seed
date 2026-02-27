import type { PurchaseRecordsClient } from 'apps/cores'
import type { PaymentsClient } from 'apps/infrastructures'
import { HttpException } from '@nestjs/common'
import { ApplicationFailure } from '@temporalio/activity'
import type { TicketPurchaseService } from '../services'

export type PurchaseInput = {
    customerId: string
    purchaseItems: Array<{ itemId: string; type: string }>
    totalPrice: number
}

export interface PurchaseActivities {
    validatePurchase(createDto: PurchaseInput): Promise<void>
    createPayment(amount: number, customerId: string): Promise<{ id: string }>
    createPurchaseRecord(
        createDto: PurchaseInput & { paymentId: string }
    ): Promise<{
        id: string
        customerId: string
        paymentId: string
        purchaseItems: Array<{ itemId: string; type: string }>
        totalPrice: number
        createdAt: string
        updatedAt: string
    }>
    completePurchase(createDto: PurchaseInput): Promise<void>
    cancelPayment(paymentId: string): Promise<void>
    deletePurchaseRecord(purchaseRecordId: string): Promise<void>
    rollbackPurchase(createDto: PurchaseInput): Promise<void>
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
            try {
                await deps.ticketPurchaseService.validatePurchase(createDto as any)
            } catch (error) {
                rethrowAsApplicationFailure(error)
            }
        },

        async createPayment(amount, customerId) {
            const payment = await deps.paymentsClient.create({ amount, customerId })
            return { id: payment.id }
        },

        async createPurchaseRecord(createDto) {
            const record = await deps.purchaseRecordsClient.create(createDto as any)
            return JSON.parse(JSON.stringify(record))
        },

        async completePurchase(createDto) {
            try {
                await deps.ticketPurchaseService.completePurchase(createDto as any)
            } catch (error) {
                rethrowAsApplicationFailure(error)
            }
        },

        async cancelPayment(paymentId) {
            await deps.paymentsClient.cancel(paymentId)
        },

        async deletePurchaseRecord(purchaseRecordId) {
            await deps.purchaseRecordsClient.delete(purchaseRecordId)
        },

        async rollbackPurchase(createDto) {
            await deps.ticketPurchaseService.rollbackPurchase(createDto as any)
        }
    }
}
