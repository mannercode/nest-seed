import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'

export const PaymentStatus = { Cancelled: 'cancelled', Completed: 'completed' } as const

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class Payment extends CrudSchema {
    @Prop({ required: true })
    amount: number

    @Prop({ default: PaymentStatus.Completed, enum: PaymentStatus, required: true, type: String })
    status: PaymentStatus

    @Prop({ required: true })
    userId: string
}
export const PaymentSchema = createCrudSchema(Payment)
