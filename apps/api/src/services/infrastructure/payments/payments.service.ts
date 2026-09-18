import { ensure, mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { CreatePaymentDto, PaymentSchema } from './dtos/index.js'
import { Payment } from './models/index.js'
import { PaymentsRepository } from './payments.repository.js'

@Injectable()
export class PaymentsService {
    constructor(private readonly repository: PaymentsRepository) {}

    async cancel(paymentId: string) {
        await this.repository.cancel(paymentId)
    }

    async cancelByPurchaseRecordId({ purchaseRecordId }: { purchaseRecordId: string }) {
        const payment = await this.repository.findByPurchaseRecordId({ purchaseRecordId })
        if (!payment) return

        await this.cancel(payment.id)
    }

    async create(createDto: CreatePaymentDto) {
        const payment = await this.repository.create(createDto)

        return this.toDto(payment)
    }

    async getMany(paymentIds: string[]) {
        const payments = await this.repository.getMany({ ids: paymentIds })

        return this.toDtos(payments)
    }

    private toDto(payment: Payment) {
        return ensure(this.toDtos([payment])[0])
    }

    private toDtos(payments: Payment[]) {
        return payments.map((payment) => mapDocToDto(payment, PaymentSchema))
    }
}
