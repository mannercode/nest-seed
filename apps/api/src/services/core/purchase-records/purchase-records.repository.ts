import {
    type TransactionContext,
    type MongoDocument,
    type MongoWriteOptions,
    type MongoUpdate,
    CrudRepository,
    ensure,
    isDuplicateKeyError,
    MongoConnection
} from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'
import { CreatePurchaseRecordDto } from './dtos/index.js'
import { PurchaseRecordIdempotencyConflictException } from './errors.js'
import { PurchaseRecord, PurchaseRecordStatus } from './models/index.js'

@Injectable()
export class PurchaseRecordsRepository extends CrudRepository<PurchaseRecord> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection,
            'purchaserecords',
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize,
            {
                indexes: [
                    {
                        key: { userId: 1, idempotencyKey: 1 },
                        name: 'user_idempotency_key_unique',
                        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
                        unique: true
                    }
                ]
            }
        )
    }

    async findCompleted({ userId }: { userId: string }) {
        const purchaseRecords = await this.findDocuments(
            this.activeFilter({ status: PurchaseRecordStatus.Completed, userId }),
            { sort: { createdAt: -1 } }
        )

        return purchaseRecords
    }

    async create(createDto: CreatePurchaseRecordDto, status: PurchaseRecordStatus) {
        const purchaseRecord = this.newDocument()
        purchaseRecord.idempotencyKey = createDto.idempotencyKey ?? null
        purchaseRecord.idempotencyFingerprint = createDto.idempotencyFingerprint ?? null
        purchaseRecord.idempotencyErrorStatus = null
        purchaseRecord.idempotencyErrorResponse = null
        purchaseRecord.idempotencyResponse = null
        purchaseRecord.userId = createDto.userId
        purchaseRecord.paymentId = createDto.paymentId ?? null
        purchaseRecord.totalPrice = createDto.totalPrice
        purchaseRecord.purchaseItems = createDto.purchaseItems
        purchaseRecord.status = status

        try {
            return await this.insertOne(purchaseRecord)
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                throw new PurchaseRecordIdempotencyConflictException()
            }
            throw error
        }
    }

    async findByIdempotencyKey({
        userId,
        idempotencyKey
    }: {
        userId: string
        idempotencyKey: string
    }) {
        // 문자열 equality만으로는 partial index의 $type 조건을 추론하지 못한다.
        const record = await this.findDocument(
            this.activeFilter({ idempotencyKey: { $eq: idempotencyKey, $type: 'string' }, userId })
        )
        return record
    }

    async markCompleted(
        purchaseRecordId: string,
        idempotencyResponse: object,
        transaction: TransactionContext
    ) {
        return ensure(
            await this.update({
                id: purchaseRecordId,
                filter: { status: PurchaseRecordStatus.Pending },
                update: { $set: { idempotencyResponse, status: PurchaseRecordStatus.Completed } },
                options: { transaction }
            }),
            'Only a pending purchase can be completed.'
        )
    }

    async setPaymentId(purchaseRecordId: string, paymentId: string) {
        return ensure(
            await this.update({
                id: purchaseRecordId,
                filter: { status: PurchaseRecordStatus.Pending },
                update: { $set: { paymentId } }
            }),
            'Only a pending purchase can receive a payment.'
        )
    }

    async beginCompensation(
        purchaseRecordId: string,
        error: { response: Record<string, unknown>; status: number }
    ) {
        const record = await this.update({
            id: purchaseRecordId,
            filter: {
                status: { $in: [PurchaseRecordStatus.Pending, PurchaseRecordStatus.Compensating] }
            },
            update: {
                $set: {
                    idempotencyErrorResponse: error.response,
                    idempotencyErrorStatus: error.status,
                    status: PurchaseRecordStatus.Compensating
                }
            }
        })
        return record !== null
    }

    async markCancelled(purchaseRecordId: string) {
        return ensure(
            await this.update({
                id: purchaseRecordId,
                filter: {
                    status: {
                        $in: [PurchaseRecordStatus.Compensating, PurchaseRecordStatus.Cancelled]
                    }
                },
                update: { $set: { status: PurchaseRecordStatus.Cancelled } }
            }),
            'Only a compensating purchase can be cancelled.'
        )
    }

    private update({
        id: purchaseRecordId,
        filter,
        update,
        options = {}
    }: {
        id: string
        filter: MongoDocument
        update: MongoUpdate
        options?: MongoWriteOptions
    }) {
        return this.findAndUpdateDocument(
            this.activeFilter({ ...this.idFilter(purchaseRecordId), ...filter }),
            this.timestamped(update),
            { ...options, returnDocument: 'after' }
        )
    }
}
