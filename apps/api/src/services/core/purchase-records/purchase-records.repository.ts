import {
    type TransactionContext,
    type MongoDocument,
    type MongoWriteOptions,
    type MongoUpdate,
    CrudRepository,
    DateUtil,
    ensure,
    isDuplicateKeyError,
    MongoConnection
} from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'
import { CreatePurchaseRecordDto } from './dtos/index.js'
import { PurchaseRecordIdempotencyConflictException } from './errors.js'
import { PurchaseEventStatus, PurchaseRecord, PurchaseRecordStatus } from './models/index.js'

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
                    },
                    { key: { status: 1, updatedAt: 1 } },
                    { key: { status: 1, completionLeaseUntil: 1 } },
                    { key: { status: 1, reconciliationLeaseUntil: 1 } },
                    { key: { status: 1, purchaseEventStatus: 1, updatedAt: 1 } },
                    {
                        key: {
                            status: 1,
                            purchaseEventStatus: 1,
                            purchaseEventPublicationLeaseUntil: 1,
                            updatedAt: 1
                        }
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
        purchaseRecord.completionId = null
        purchaseRecord.completionLeaseUntil = null
        purchaseRecord.totalPrice = createDto.totalPrice
        purchaseRecord.purchaseItems = createDto.purchaseItems
        purchaseRecord.reconciliationId = null
        purchaseRecord.reconciliationLeaseUntil = null
        purchaseRecord.purchaseEventPublicationId = null
        purchaseRecord.purchaseEventPublicationLeaseUntil = null
        purchaseRecord.status = status
        purchaseRecord.purchaseEventStatus =
            status === PurchaseRecordStatus.Pending
                ? PurchaseEventStatus.Pending
                : PurchaseEventStatus.Published

        try {
            return await this.insertOne(purchaseRecord)
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                throw new PurchaseRecordIdempotencyConflictException()
            }
            throw error
        }
    }

    async findIdempotencyOperation({
        userId,
        idempotencyKey
    }: {
        userId: string
        idempotencyKey: string
    }) {
        const record = await this.findDocument(this.activeFilter({ idempotencyKey, userId }))
        return record
    }

    async findReconciliationCandidates({
        before,
        now
    }: {
        before: Temporal.Instant
        now: Temporal.Instant
    }) {
        const purchaseRecords = await this.findDocuments(
            this.activeFilter({
                $or: [
                    { status: PurchaseRecordStatus.Pending, updatedAt: { $lte: before } },
                    {
                        completionLeaseUntil: { $lte: now },
                        status: PurchaseRecordStatus.Completing
                    },
                    {
                        reconciliationLeaseUntil: { $lte: now },
                        status: PurchaseRecordStatus.Compensating
                    }
                ]
            }),
            { limit: 100, sort: { updatedAt: 1 } }
        )

        return purchaseRecords
    }

    async findPending({ id: purchaseRecordId }: { id: string }) {
        const record = await this.findDocument(
            this.activeFilter({ _id: purchaseRecordId, status: PurchaseRecordStatus.Pending })
        )
        return record
    }

    async claimForReconciliation(
        purchaseRecordId: string,
        {
            before,
            leaseUntil,
            now,
            reconciliationId,
            completionId,
            idempotencyError
        }: {
            before: Temporal.Instant
            leaseUntil: Temporal.Instant
            now: Temporal.Instant
            reconciliationId: string
            completionId?: string
            idempotencyError?: { response: Record<string, unknown>; status: number }
        }
    ) {
        const candidates = [
            { status: PurchaseRecordStatus.Pending, updatedAt: { $lte: before } },
            { completionLeaseUntil: { $lte: now }, status: PurchaseRecordStatus.Completing },
            { reconciliationLeaseUntil: { $lte: now }, status: PurchaseRecordStatus.Compensating },
            ...(completionId ? [{ completionId, status: PurchaseRecordStatus.Completing }] : [])
        ]
        const record = await this.update({
            id: purchaseRecordId,
            filter: { $or: candidates },
            update: {
                $set: {
                    completionId: null,
                    completionLeaseUntil: null,
                    ...(idempotencyError
                        ? {
                              idempotencyErrorResponse: idempotencyError.response,
                              idempotencyErrorStatus: idempotencyError.status
                          }
                        : {}),
                    reconciliationId,
                    reconciliationLeaseUntil: leaseUntil,
                    status: PurchaseRecordStatus.Compensating
                }
            }
        })

        return record
    }

    async findPublicationCandidates({
        before,
        now
    }: {
        before: Temporal.Instant
        now: Temporal.Instant
    }) {
        const purchaseRecords = await this.findDocuments(
            this.activeFilter({
                purchaseEventStatus: PurchaseEventStatus.Pending,
                status: PurchaseRecordStatus.Completed,
                updatedAt: { $lte: before },
                $or: [
                    { purchaseEventPublicationLeaseUntil: null },
                    { purchaseEventPublicationLeaseUntil: { $lte: now } }
                ]
            }),
            { limit: 100, sort: { updatedAt: 1 } }
        )

        return purchaseRecords
    }

    async claimEventPublication(
        purchaseRecordId: string,
        {
            before,
            leaseUntil,
            now,
            publicationId
        }: {
            before: Temporal.Instant
            leaseUntil: Temporal.Instant
            now: Temporal.Instant
            publicationId: string
        }
    ) {
        const purchaseRecord = await this.update({
            id: purchaseRecordId,
            filter: {
                purchaseEventStatus: PurchaseEventStatus.Pending,
                status: PurchaseRecordStatus.Completed,
                updatedAt: { $lte: before },
                $or: [
                    { purchaseEventPublicationLeaseUntil: null },
                    { purchaseEventPublicationLeaseUntil: { $lte: now } }
                ]
            },
            update: {
                $set: {
                    purchaseEventPublicationId: publicationId,
                    purchaseEventPublicationLeaseUntil: leaseUntil
                }
            }
        })

        return purchaseRecord
    }

    async claimForCompletion(
        purchaseRecordId: string,
        completionId: string,
        completionLeaseUntil: Temporal.Instant
    ) {
        const purchaseRecord = await this.update({
            id: purchaseRecordId,
            filter: { status: PurchaseRecordStatus.Pending },
            update: {
                $set: {
                    completionId,
                    completionLeaseUntil,
                    status: PurchaseRecordStatus.Completing
                }
            }
        })
        if (!purchaseRecord) {
            throw new Error(`Purchase record is no longer pending: ${purchaseRecordId}`)
        }

        return ensure(purchaseRecord)
    }

    async markCompleted(
        purchaseRecordId: string,
        completionId: string,
        transaction: TransactionContext | undefined = undefined,
        idempotencyResponse: object | undefined = undefined
    ) {
        const purchaseRecord = await this.update({
            id: purchaseRecordId,
            filter: { completionId, status: PurchaseRecordStatus.Completing },
            update: {
                $set: {
                    ...(idempotencyResponse ? { idempotencyResponse } : {}),
                    status: PurchaseRecordStatus.Completed
                },
                $unset: {
                    completionId: 1,
                    completionLeaseUntil: 1,
                    reconciliationId: 1,
                    reconciliationLeaseUntil: 1
                }
            },
            options: { transaction }
        })
        if (!purchaseRecord) {
            throw new Error(`Purchase completion lease was lost: ${purchaseRecordId}`)
        }

        return ensure(purchaseRecord)
    }

    async setPaymentId(purchaseRecordId: string, paymentId: string) {
        const purchaseRecord = await this.update({
            id: purchaseRecordId,
            filter: { status: PurchaseRecordStatus.Pending },
            update: { $set: { paymentId } }
        })
        if (!purchaseRecord) {
            throw new Error(`Purchase record is no longer pending: ${purchaseRecordId}`)
        }

        return ensure(purchaseRecord)
    }

    async markCancelled(purchaseRecordId: string, reconciliationId: string) {
        await this.updateDocument(
            this.activeFilter({
                _id: purchaseRecordId,
                reconciliationId,
                status: PurchaseRecordStatus.Compensating
            }),
            this.timestamped({
                $set: {
                    reconciliationId: null,
                    reconciliationLeaseUntil: null,
                    status: PurchaseRecordStatus.Cancelled
                }
            })
        )
    }

    async releaseReconciliationClaim(purchaseRecordId: string, reconciliationId: string) {
        await this.updateDocument(
            this.activeFilter({
                _id: purchaseRecordId,
                reconciliationId,
                status: PurchaseRecordStatus.Compensating
            }),
            this.timestamped({ $set: { reconciliationLeaseUntil: DateUtil.epoch() } })
        )
    }

    async markEventPublished(purchaseRecordId: string, publicationId: string) {
        const result = await this.updateDocument(
            this.activeFilter({
                _id: purchaseRecordId,
                purchaseEventPublicationId: publicationId,
                purchaseEventStatus: PurchaseEventStatus.Pending,
                status: PurchaseRecordStatus.Completed
            }),
            this.timestamped({
                $set: {
                    purchaseEventPublicationId: null,
                    purchaseEventPublicationLeaseUntil: null,
                    purchaseEventStatus: PurchaseEventStatus.Published
                }
            })
        )

        return result.modifiedCount === 1
    }

    async releaseEventPublicationClaim(purchaseRecordId: string, publicationId: string) {
        await this.updateDocument(
            this.activeFilter({
                _id: purchaseRecordId,
                purchaseEventPublicationId: publicationId,
                purchaseEventStatus: PurchaseEventStatus.Pending,
                status: PurchaseRecordStatus.Completed
            }),
            this.timestamped({
                $set: { purchaseEventPublicationId: null, purchaseEventPublicationLeaseUntil: null }
            })
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
            this.activeFilter({ _id: purchaseRecordId, ...filter }),
            this.timestamped(update),
            { ...options, returnDocument: 'after' }
        )
    }
}
