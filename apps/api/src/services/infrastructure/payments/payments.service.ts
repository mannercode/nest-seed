import type { ClientSession } from 'mongoose'
import { ensure, mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { CreatePaymentDto, PaymentDto } from './dtos/index.js'
import { Payment } from './models/index.js'
import { PaymentsRepository } from './payments.repository.js'

@Injectable()
export class PaymentsService {
    constructor(private readonly repository: PaymentsRepository) {}

    async cancel(paymentId: string) {
        await this.repository.cancel(paymentId)
    }

    async cancelByPurchaseRecordId(purchaseRecordId: string) {
        const payment = await this.repository.findByPurchaseRecordId(purchaseRecordId)
        if (!payment) return

        await this.cancel(payment.id)
    }

    async create(createDto: CreatePaymentDto) {
        const payment = await this.repository.create(createDto)

        return this.toDto(payment)
    }

    async findUnresolvedBefore(before: Date) {
        const payments = await this.repository.findUnresolvedBefore(before)
        return this.toDtos(payments)
    }

    async getMany(paymentIds: string[]) {
        const payments = await this.repository.getByIds(paymentIds)

        return this.toDtos(payments)
    }

    async resolvePurchase(
        purchaseRecordId: string,
        session: ClientSession | undefined = undefined
    ) {
        await this.repository.resolvePurchase(purchaseRecordId, session)
    }

    async resolveLegacyPayment(paymentId: string, purchaseRecordId: string) {
        await this.repository.resolveLegacyPayment(paymentId, purchaseRecordId)
    }

    async linkLegacyPayment(paymentId: string, purchaseRecordId: string) {
        await this.repository.linkLegacyPayment(paymentId, purchaseRecordId)
    }

    private toDto(payment: Payment) {
        return ensure(this.toDtos([payment])[0])
    }

    private toDtos(payments: Payment[]) {
        return payments.map((payment) => ({
            ...mapDocToDto(payment, PaymentDto, [
                'id',
                'purchaseRecordId',
                'userId',
                'amount',
                'status',
                'createdAt',
                'updatedAt'
            ]),
            purchaseRecordId: payment.purchaseRecordId ?? null
        }))
    }
}
