import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, SchemaJson, createMongooseSchema, createSchemaOptions } from 'common'
import { HydratedDocument, Types } from 'mongoose'

@Schema(createSchemaOptions({ json: { timestamps: true } }))
export class Payment extends MongooseSchema {
    @Prop({ required: true })
    customerId: Types.ObjectId

    @Prop({ required: true })
    amount: number

    createdAt: Date
    updatedAt: Date
}
export type PaymentDto = SchemaJson<Payment>

export type PaymentDocument = HydratedDocument<Payment>
export const PaymentSchema = createMongooseSchema(Payment, {})
