import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'

@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class Payment extends CrudSchema {
    @Prop({ required: true })
    amount: number

    @Prop({ required: true })
    userId: string
}
export const PaymentSchema = createCrudSchema(Payment)
