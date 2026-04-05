import { createMongooseSchema, MongooseSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'config'

@Schema(MongooseConfigModule.schemaOptions)
export class Payment extends MongooseSchema {
    @Prop({ required: true })
    amount: number

    @Prop({ required: true })
    customerId: string
}
export const PaymentSchema = createMongooseSchema(Payment)
