import { CrudDocument } from '@mannercode/common'

export const PaymentStatus = { Cancelled: 'cancelled', Completed: 'completed' } as const

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export class Payment extends CrudDocument {
    amount: number

    // 기존 결제 문서는 이 필드가 없으므로 nullable로 읽되, 새 결제 입력은 DTO에서 필수다.
    purchaseRecordId: null | string

    // 결제 생성과 구매 완료 사이에서 프로세스가 종료돼도 후속 작업이 결제 결과를
    // 구매 상태와 다시 대조할 수 있게 하는 durable resolution marker다.
    // 새 결제는 create에서 true로 저장하고, 필드가 없는 upgrade 전 결제는
    // reconciliation이 PurchaseRecord.paymentId로 역조회해 백필한다.
    requiresPurchaseResolution: boolean

    status: PaymentStatus

    userId: string
}
