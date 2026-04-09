import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'config'

@Schema(MongooseConfigModule.schemaOptions)
export class Payment extends CrudSchema {
    @Prop({ required: true })
    amount: number

    @Prop({ required: true })
    customerId: string
}
export const PaymentSchema = createCrudSchema(Payment)
