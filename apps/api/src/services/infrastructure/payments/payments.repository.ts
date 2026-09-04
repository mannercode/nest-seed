import {
    CrudRepository,
    DateUtil,
    ensure,
    isDuplicateKeyError,
    mongoArrayToPublic,
    mongoToPublic,
    MongoErrors,
    objectId
} from '@mannercode/common'
import { Injectable, NotFoundException } from '@nestjs/common'
import { ObjectId, type ClientSession } from 'mongodb'
import { AppConfigService, MongoConnection } from '#config'
import { CreatePaymentDto } from './dtos/index.js'
import { Payment, PaymentStatus } from './models/index.js'

@Injectable()
export class PaymentsRepository extends CrudRepository<Payment> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection.db.collection('payments'),
            connection.client,
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize,
            {
                indexes: [
                    {
                        key: { purchaseRecordId: 1 },
                        name: 'purchaseRecordId_partial_unique',
                        partialFilterExpression: { purchaseRecordId: { $type: 'string' } },
                        unique: true
                    },
                    { key: { requiresPurchaseResolution: 1, status: 1, createdAt: 1 } }
                ]
            }
        )
    }

    async cancel(paymentId: string) {
        // 결제는 감사 추적을 위해 행을 지우지 않고, 취소와 resolution 해소를 같은 문서 쓰기로 확정한다.
        const payment = await this.collection.findOneAndUpdate(
            this.activeFilter({ _id: objectId(paymentId) }),
            this.timestamped({
                $set: { requiresPurchaseResolution: false, status: PaymentStatus.Cancelled }
            }),
            { returnDocument: 'after' }
        )
        if (!payment) throw new NotFoundException(MongoErrors.DocumentNotFound(paymentId))
    }

    async create(createDto: CreatePaymentDto) {
        // purchaseRecordId가 결제의 idempotency key다. 재시도나 커밋 결과 불명확 상황에서도
        // 같은 구매에 두 결제 행을 만들지 않는다.
        const now = DateUtil.toDate(DateUtil.now())
        try {
            await this.collection.updateOne(
                this.activeFilter({ purchaseRecordId: createDto.purchaseRecordId }),
                {
                    $setOnInsert: {
                        __v: 0,
                        _id: new ObjectId(),
                        amount: createDto.amount,
                        createdAt: now,
                        deletedAt: null,
                        purchaseRecordId: createDto.purchaseRecordId,
                        requiresPurchaseResolution: true,
                        status: PaymentStatus.Completed,
                        updatedAt: now,
                        userId: createDto.userId
                    }
                },
                // no-op 재시도가 updatedAt을 바꾸지 않게 insert timestamps를 직접 지정한다.
                { upsert: true }
            )
        } catch (error) {
            // 동시 upsert 둘이 모두 insert를 택하면 unique index에서 하나가 진다.
            // 그 경우 승자가 만든 행을 아래에서 읽으면 되고, 다른 DB 오류는 숨기지 않는다.
            if (!isDuplicateKeyError(error)) throw error
        }
        const payment = await this.collection.findOne(
            this.activeFilter({ purchaseRecordId: createDto.purchaseRecordId })
        )

        return ensure(mongoToPublic<Payment>(payment))
    }

    async findUnresolvedBefore(before: Temporal.Instant) {
        const payments = await this.collection
            .find(
                this.activeFilter({
                    createdAt: { $lte: before },
                    requiresPurchaseResolution: true,
                    status: PaymentStatus.Completed
                })
            )
            .sort({ createdAt: 1 })
            .limit(100)
            .toArray()

        return mongoArrayToPublic<Payment>(payments)
    }

    async findByPurchaseRecordId(purchaseRecordId: string) {
        const payment = await this.collection.findOne(this.activeFilter({ purchaseRecordId }))
        return mongoToPublic<Payment>(payment)
    }

    async resolvePurchase(
        purchaseRecordId: string,
        session: ClientSession | undefined = undefined
    ) {
        await this.collection.updateOne(
            this.activeFilter({
                purchaseRecordId,
                requiresPurchaseResolution: true,
                status: PaymentStatus.Completed
            }),
            this.timestamped({ $set: { requiresPurchaseResolution: false } }),
            { session }
        )
    }
}
