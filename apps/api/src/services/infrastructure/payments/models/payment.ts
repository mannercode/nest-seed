import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from '#config'

export const PaymentStatus = { Cancelled: 'cancelled', Completed: 'completed' } as const

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class Payment extends CrudSchema {
    @Prop({ required: true })
    amount: number

    // 기존 결제 문서는 이 필드가 없으므로 nullable로 읽되, 새 결제 입력은 DTO에서 필수다.
    @Prop({ default: null, type: String })
    purchaseRecordId: null | string

    // 결제 생성과 구매 완료 사이에서 프로세스가 종료돼도 후속 작업이 결제 결과를
    // 구매 상태와 다시 대조할 수 있게 하는 durable resolution marker다.
    // 새 결제는 create에서 true로 저장하고, 필드가 없는 upgrade 전 결제는
    // reconciliation이 PurchaseRecord.paymentId로 역조회해 백필한다.
    @Prop({ default: false, required: true })
    requiresPurchaseResolution: boolean

    @Prop({ default: PaymentStatus.Completed, enum: PaymentStatus, required: true, type: String })
    status: PaymentStatus

    @Prop({ required: true })
    userId: string
}
export const PaymentSchema = createCrudSchema(Payment)

// 기존 payment 여러 건의 missing/null 값 때문에 unique index 생성이 실패하지 않도록
// purchaseRecordId가 채워진 새 문서에만 idempotency 제약을 적용한다.
PaymentSchema.index(
    { purchaseRecordId: 1 },
    {
        // 같은 key의 과거 full unique index와 옵션 충돌로 기동이 막히지 않도록 이름을 분리한다.
        // 새 쓰기는 purchaseRecordId가 필수라 두 인덱스가 공존하는 롤링 배포 중에도 제약은 같다.
        name: 'purchaseRecordId_partial_unique',
        partialFilterExpression: { purchaseRecordId: { $type: 'string' } },
        unique: true
    }
)
PaymentSchema.index({ requiresPurchaseResolution: 1, status: 1, createdAt: 1 })
