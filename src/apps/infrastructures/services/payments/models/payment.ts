import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { MongooseConfigModule } from 'shared'

@Schema(MongooseConfigModule.schemaOptions)
export class Payment extends MongooseSchema {
    @Prop({ required: true })
    customerId: string

    @Prop({ required: true })
    amount: number
}
export const PaymentSchema = createMongooseSchema(Payment)
