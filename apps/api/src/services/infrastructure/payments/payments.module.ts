import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseSetupModule } from 'modules'
import { Payment, PaymentSchema } from './models'
import { PaymentsRepository } from './payments.repository'
import { PaymentsService } from './payments.service'

@Module({
    exports: [PaymentsService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Payment.name, schema: PaymentSchema }],
            MongooseSetupModule.connectionName
        )
    ],
    providers: [PaymentsService, PaymentsRepository]
})
export class PaymentsModule {}
