import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MONGO_CONNECTION_NAME } from '#config'
import { Payment, PaymentSchema } from './models/index.js'
import { PaymentsRepository } from './payments.repository.js'
import { PaymentsService } from './payments.service.js'

@Module({
    exports: [PaymentsService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Payment.name, schema: PaymentSchema }],
            MONGO_CONNECTION_NAME
        )
    ],
    providers: [PaymentsService, PaymentsRepository]
})
export class PaymentsModule {}
