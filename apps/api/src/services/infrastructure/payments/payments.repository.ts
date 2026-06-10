import { CrudRepository } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { Model } from 'mongoose'
import { CreatePaymentDto } from './dtos'
import { Payment, PaymentStatus } from './models'

@Injectable()
export class PaymentsRepository extends CrudRepository<Payment> {
    constructor(
        @InjectModel(Payment.name, MONGO_CONNECTION_NAME)
        readonly model: Model<Payment>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize, config.http.paginationMaxSize)
    }

    async cancel(paymentId: string) {
        // 결제는 감사 추적을 위해 행을 지우지 않고 status만 전이한다.
        const payment = await this.getDocumentById(paymentId)
        payment.status = PaymentStatus.Cancelled
        await payment.save()
    }

    async create(createDto: CreatePaymentDto) {
        const payment = this.newDocument()
        payment.userId = createDto.userId
        payment.amount = createDto.amount
        payment.status = PaymentStatus.Completed

        await payment.save()

        return payment.toJSON()
    }
}
