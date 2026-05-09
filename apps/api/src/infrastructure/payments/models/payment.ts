import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'shared'

@Schema(MongooseConfigModule.schemaOptions)
export class Payment extends CrudSchema {
    @Prop({ required: true })
    amount: number

    @Prop({ required: true })
    userId: string
}
export const PaymentSchema = createCrudSchema(Payment)
