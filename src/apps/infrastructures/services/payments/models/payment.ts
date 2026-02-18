import { Prop, Schema } from '@nestjs/mongoose'
import { createMongooseSchema, MongooseSchema } from 'common'
import { MongooseConfigModule } from 'shared'

@Schema(MongooseConfigModule.schemaOptions)
export class Payment extends MongooseSchema {
    @Prop({ required: true })
    amount: number

    @Prop({ required: true })
    customerId: string
}
export const PaymentSchema = createMongooseSchema(Payment)
