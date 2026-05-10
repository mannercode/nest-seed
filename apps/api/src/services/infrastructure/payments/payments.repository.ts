import { CrudRepository } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseSetupModule } from 'modules'
import { Model } from 'mongoose'
import { CreatePaymentDto } from './dtos'
import { Payment } from './models'

@Injectable()
export class PaymentsRepository extends CrudRepository<Payment> {
    constructor(
        @InjectModel(Payment.name, MongooseSetupModule.connectionName)
        readonly model: Model<Payment>
    ) {
        super(model, MongooseSetupModule.maxTake)
    }

    async cancel(paymentId: string) {
        await this.deleteById(paymentId)
    }

    async create(createDto: CreatePaymentDto) {
        const payment = this.newDocument()
        payment.userId = createDto.userId
        payment.amount = createDto.amount

        await payment.save()

        return payment.toJSON()
    }
}
