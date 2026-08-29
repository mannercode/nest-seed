import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { IsEnum, IsNotEmpty, IsString } from 'class-validator'
import { MONGOOSE_SCHEMA_OPTIONS } from '#config'

export const PurchaseItemType = { Foods: 'foods', Tickets: 'tickets' } as const

export type PurchaseItemType = (typeof PurchaseItemType)[keyof typeof PurchaseItemType]

export const PurchaseRecordStatus = {
    Cancelled: 'cancelled',
    Compensating: 'compensating',
    Completed: 'completed',
    Completing: 'completing',
    Pending: 'pending'
} as const

export type PurchaseRecordStatus = (typeof PurchaseRecordStatus)[keyof typeof PurchaseRecordStatus]

export const PurchaseEventStatus = { Pending: 'pending', Published: 'published' } as const

export type PurchaseEventStatus = (typeof PurchaseEventStatus)[keyof typeof PurchaseEventStatus]

export class PurchaseItem {
    @IsNotEmpty()
    @IsString()
    itemId: string

    @IsEnum(PurchaseItemType)
    type: PurchaseItemType
}

@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class PurchaseRecord extends CrudSchema {
    @Prop({ default: null, type: String })
    idempotencyKey: null | string

    @Prop({ default: null, type: String })
    idempotencyFingerprint: null | string

    @Prop({ default: null, type: Number })
    idempotencyErrorStatus: null | number

    @Prop({ default: null, type: Object })
    idempotencyErrorResponse: null | Record<string, unknown>

    @Prop({ default: null, type: Object })
    idempotencyResponse: null | Record<string, unknown>

    @Prop({ required: true })
    userId: string

    @Prop({ default: null, type: String })
    paymentId: null | string

    @Prop({ default: null, type: String })
    completionId: null | string

    @Prop({ default: null, type: Date })
    completionLeaseUntil: Date | null

    @Prop({ default: null, type: String })
    reconciliationId: null | string

    @Prop({ default: null, type: Date })
    reconciliationLeaseUntil: Date | null

    @Prop({ default: null, type: String })
    purchaseEventPublicationId: null | string

    @Prop({ default: null, type: Date })
    purchaseEventPublicationLeaseUntil: Date | null

    @Prop({
        default: PurchaseEventStatus.Published,
        enum: PurchaseEventStatus,
        required: true,
        type: String
    })
    purchaseEventStatus: PurchaseEventStatus

    @Prop({ required: true, type: [Object] })
    purchaseItems: PurchaseItem[]

    @Prop({ required: true })
    totalPrice: number

    @Prop({
        default: PurchaseRecordStatus.Completed,
        enum: PurchaseRecordStatus,
        required: true,
        type: String
    })
    status: PurchaseRecordStatus
}
export const PurchaseRecordSchema = createCrudSchema(PurchaseRecord)

PurchaseRecordSchema.index(
    { userId: 1, idempotencyKey: 1 },
    {
        name: 'user_idempotency_key_unique',
        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
        unique: true
    }
)
PurchaseRecordSchema.index({ status: 1, updatedAt: 1 })
PurchaseRecordSchema.index({ status: 1, completionLeaseUntil: 1 })
PurchaseRecordSchema.index({ status: 1, reconciliationLeaseUntil: 1 })
PurchaseRecordSchema.index({ status: 1, purchaseEventStatus: 1, updatedAt: 1 })
PurchaseRecordSchema.index({
    status: 1,
    purchaseEventStatus: 1,
    purchaseEventPublicationLeaseUntil: 1,
    updatedAt: 1
})
// upgrade 전 payment에 purchaseRecordId가 없어도 paymentId로 역조회하는
// reconciliation이 collection scan을 하지 않게 한다.
PurchaseRecordSchema.index(
    { paymentId: 1 },
    {
        name: 'paymentId_partial_lookup',
        partialFilterExpression: { paymentId: { $type: 'string' } }
    }
)
