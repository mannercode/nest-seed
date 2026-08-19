import { CrudRepository, ensure, isDuplicateKeyError, leanOneToPublic } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { ClientSession, Model } from 'mongoose'
import { CreatePaymentDto } from './dtos'
import { Payment, PaymentStatus } from './models'

@Injectable()
export class PaymentsRepository extends CrudRepository<Payment> {
    constructor(
        @InjectModel(Payment.name, MONGO_CONNECTION_NAME)
        readonly model: Model<Payment>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize, config.http.paginationMaxSize)
    }

    async cancel(paymentId: string) {
        // 결제는 감사 추적을 위해 행을 지우지 않고, 취소와 resolution 해소를 같은 문서 쓰기로 확정한다.
        const payment = await this.getDocumentById(paymentId)
        payment.requiresPurchaseResolution = false
        payment.status = PaymentStatus.Cancelled
        await payment.save()
    }

    async create(createDto: CreatePaymentDto) {
        // purchaseRecordId가 결제의 idempotency key다. 재시도나 커밋 결과 불명확 상황에서도
        // 같은 구매에 두 결제 행을 만들지 않는다.
        const now = new Date()
        try {
            await this.model
                .updateOne(
                    { purchaseRecordId: createDto.purchaseRecordId },
                    {
                        $setOnInsert: {
                            amount: createDto.amount,
                            createdAt: now,
                            purchaseRecordId: createDto.purchaseRecordId,
                            requiresPurchaseResolution: true,
                            status: PaymentStatus.Completed,
                            updatedAt: now,
                            userId: createDto.userId
                        }
                    },
                    // no-op 재시도가 updatedAt을 바꾸지 않게 insert timestamps를 직접 지정한다.
                    { timestamps: false, upsert: true }
                )
                .exec()
        } catch (error) {
            // 동시 upsert 둘이 모두 insert를 택하면 unique index에서 하나가 진다.
            // 그 경우 승자가 만든 행을 아래에서 읽으면 되고, 다른 DB 오류는 숨기지 않는다.
            if (!isDuplicateKeyError(error)) throw error
        }
        const payment = await this.model
            .findOne({ purchaseRecordId: createDto.purchaseRecordId })
            .lean()
            .exec()

        return ensure(leanOneToPublic<Payment>(payment))
    }

    async findUnresolvedBefore(before: Date) {
        const payments = await this.model
            .find({
                createdAt: { $lte: before },
                $or: [
                    { requiresPurchaseResolution: true },
                    { requiresPurchaseResolution: { $exists: false } }
                ],
                status: PaymentStatus.Completed
            })
            .sort({ createdAt: 1 })
            .limit(100)
            .lean()
            .exec()

        return payments.map((payment) => ensure(leanOneToPublic<Payment>(payment)))
    }

    async findByPurchaseRecordId(purchaseRecordId: string) {
        const payment = await this.model.findOne({ purchaseRecordId }).lean().exec()
        return leanOneToPublic<Payment>(payment)
    }

    async resolvePurchase(
        purchaseRecordId: string,
        session: ClientSession | undefined = undefined
    ) {
        await this.model
            .updateOne(
                {
                    purchaseRecordId,
                    $or: [
                        { requiresPurchaseResolution: true },
                        { requiresPurchaseResolution: { $exists: false } }
                    ],
                    status: PaymentStatus.Completed
                },
                { $set: { requiresPurchaseResolution: false } },
                { session }
            )
            .exec()
    }

    async resolveLegacyPayment(paymentId: string, purchaseRecordId: string) {
        await this.model
            .updateOne(
                {
                    _id: paymentId,
                    $or: [
                        { requiresPurchaseResolution: true },
                        { requiresPurchaseResolution: { $exists: false } }
                    ],
                    status: PaymentStatus.Completed
                },
                { $set: { purchaseRecordId, requiresPurchaseResolution: false } }
            )
            .exec()
    }

    async linkLegacyPayment(paymentId: string, purchaseRecordId: string) {
        await this.model
            .updateOne(
                {
                    _id: paymentId,
                    requiresPurchaseResolution: { $exists: false },
                    status: PaymentStatus.Completed
                },
                { $set: { purchaseRecordId, requiresPurchaseResolution: true } }
            )
            .exec()
    }
}
