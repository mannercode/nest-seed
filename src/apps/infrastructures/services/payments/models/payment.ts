import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument, Types } from 'mongoose'
import { MongooseConfigModule } from 'shared'

@Schema(MongooseConfigModule.schemaOptions)
export class Payment extends MongooseSchema {
    @Prop({ required: true })
    customerId: Types.ObjectId

    @Prop({ required: true })
    amount: number
}
export type PaymentDocument = HydratedDocument<Payment>
export const PaymentSchema = createMongooseSchema(Payment)
