import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MethodLog, MongooseRepository, objectId } from 'common'
import { MongooseConfig } from 'config'
import { Model } from 'mongoose'
import { PaymentCreateDto } from './dtos'
import { Payment } from './models'

@Injectable()
export class PaymentsRepository extends MongooseRepository<Payment> {
    constructor(@InjectModel(Payment.name, MongooseConfig.connName) model: Model<Payment>) {
        super(model)
    }

    @MethodLog()
    async createPayment(createDto: PaymentCreateDto) {
        const payment = this.newDocument()
        payment.customerId = objectId(createDto.customerId)
        payment.amount = createDto.amount
        await payment.save()

        return payment
    }
}
