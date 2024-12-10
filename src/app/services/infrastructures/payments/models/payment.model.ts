import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { MongooseConfig } from 'config'
import { HydratedDocument, Types } from 'mongoose'

@Schema(MongooseConfig.schemaOptions)
export class Payment extends MongooseSchema {
    @Prop({ required: true })
    customerId: Types.ObjectId

    @Prop({ required: true })
    amount: number
}
export type PaymentDocument = HydratedDocument<Payment>
export const PaymentSchema = createMongooseSchema(Payment)
