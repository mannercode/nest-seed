import type { ClientSession, Document, FindOneAndUpdateOptions, UpdateFilter } from 'mongodb'
import {
    CrudRepository,
    DateUtil,
    ensure,
    mongoArrayToPublic,
    mongoToPublic,
    objectId
} from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService, MongoConnection } from '#config'
import { CreatePurchaseRecordDto } from './dtos/index.js'
import { PurchaseEventStatus, PurchaseRecord, PurchaseRecordStatus } from './models/index.js'

@Injectable()
export class PurchaseRecordsRepository extends CrudRepository<PurchaseRecord> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection.db.collection('purchaserecords'),
            connection.client,
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

    async findByUserId(userId: string) {
        const purchaseRecords = await this.collection
            .find(this.activeFilter({ status: PurchaseRecordStatus.Completed, userId }))
            .sort({ createdAt: -1 })
            .toArray()

        return mongoArrayToPublic<PurchaseRecord>(purchaseRecords)
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

        return this.insertOne(purchaseRecord)
    }

    async findByIdempotencyKey(userId: string, idempotencyKey: string) {
        const record = await this.collection.findOne(this.activeFilter({ idempotencyKey, userId }))
        return mongoToPublic<PurchaseRecord>(record)
    }

    async findPendingBefore(before: Temporal.Instant, now: Temporal.Instant) {
        const purchaseRecords = await this.collection
            .find(
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
                })
            )
            .sort({ updatedAt: 1 })
            .limit(100)
            .toArray()

        return mongoArrayToPublic<PurchaseRecord>(purchaseRecords)
    }

    async findPendingById(purchaseRecordId: string) {
        const record = await this.collection.findOne(
            this.activeFilter({
                _id: objectId(purchaseRecordId),
                status: PurchaseRecordStatus.Pending
            })
        )
        return mongoToPublic<PurchaseRecord>(record)
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
        const record = await this.updateById(
            purchaseRecordId,
            { $or: candidates },
            {
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
        )

        return mongoToPublic<PurchaseRecord>(record)
    }

    async findUnpublishedBefore(before: Temporal.Instant, now: Temporal.Instant) {
        const purchaseRecords = await this.collection
            .find(
                this.activeFilter({
                    purchaseEventStatus: PurchaseEventStatus.Pending,
                    status: PurchaseRecordStatus.Completed,
                    updatedAt: { $lte: before },
                    $or: [
                        { purchaseEventPublicationLeaseUntil: null },
                        { purchaseEventPublicationLeaseUntil: { $lte: now } }
                    ]
                })
            )
            .sort({ updatedAt: 1 })
            .limit(100)
            .toArray()

        return mongoArrayToPublic<PurchaseRecord>(purchaseRecords)
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
        const purchaseRecord = await this.updateById(
            purchaseRecordId,
            {
                purchaseEventStatus: PurchaseEventStatus.Pending,
                status: PurchaseRecordStatus.Completed,
                updatedAt: { $lte: before },
                $or: [
                    { purchaseEventPublicationLeaseUntil: null },
                    { purchaseEventPublicationLeaseUntil: { $lte: now } }
                ]
            },
            {
                $set: {
                    purchaseEventPublicationId: publicationId,
                    purchaseEventPublicationLeaseUntil: leaseUntil
                }
            }
        )

        return mongoToPublic<PurchaseRecord>(purchaseRecord)
    }

    async claimForCompletion(
        purchaseRecordId: string,
        completionId: string,
        completionLeaseUntil: Temporal.Instant
    ) {
        const purchaseRecord = await this.updateById(
            purchaseRecordId,
            { status: PurchaseRecordStatus.Pending },
            {
                $set: {
                    completionId,
                    completionLeaseUntil,
                    status: PurchaseRecordStatus.Completing
                }
            }
        )
        if (!purchaseRecord) {
            throw new Error(`Purchase record is no longer pending: ${purchaseRecordId}`)
        }

        return ensure(mongoToPublic<PurchaseRecord>(purchaseRecord))
    }

    async markCompleted(
        purchaseRecordId: string,
        completionId: string,
        session: ClientSession | undefined = undefined,
        idempotencyResponse: object | undefined = undefined
    ) {
        const purchaseRecord = await this.updateById(
            purchaseRecordId,
            { completionId, status: PurchaseRecordStatus.Completing },
            {
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
            { session }
        )
        if (!purchaseRecord) {
            throw new Error(`Purchase completion lease was lost: ${purchaseRecordId}`)
        }

        return ensure(mongoToPublic<PurchaseRecord>(purchaseRecord))
    }

    async setPaymentId(purchaseRecordId: string, paymentId: string) {
        const purchaseRecord = await this.updateById(
            purchaseRecordId,
            { status: PurchaseRecordStatus.Pending },
            { $set: { paymentId } }
        )
        if (!purchaseRecord) {
            throw new Error(`Purchase record is no longer pending: ${purchaseRecordId}`)
        }

        return ensure(mongoToPublic<PurchaseRecord>(purchaseRecord))
    }

    async markCancelled(purchaseRecordId: string, reconciliationId: string) {
        await this.collection.updateOne(
            this.activeFilter({
                _id: objectId(purchaseRecordId),
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
        await this.collection.updateOne(
            this.activeFilter({
                _id: objectId(purchaseRecordId),
                reconciliationId,
                status: PurchaseRecordStatus.Compensating
            }),
            this.timestamped({ $set: { reconciliationLeaseUntil: DateUtil.epoch() } })
        )
    }

    async markEventPublished(purchaseRecordId: string, publicationId: string) {
        const result = await this.collection.updateOne(
            this.activeFilter({
                _id: objectId(purchaseRecordId),
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
        await this.collection.updateOne(
            this.activeFilter({
                _id: objectId(purchaseRecordId),
                purchaseEventPublicationId: publicationId,
                purchaseEventStatus: PurchaseEventStatus.Pending,
                status: PurchaseRecordStatus.Completed
            }),
            this.timestamped({
                $set: { purchaseEventPublicationId: null, purchaseEventPublicationLeaseUntil: null }
            })
        )
    }

    private updateById(
        purchaseRecordId: string,
        filter: Document,
        update: UpdateFilter<Document>,
        options: FindOneAndUpdateOptions = {}
    ) {
        return this.collection.findOneAndUpdate(
            this.activeFilter({ _id: objectId(purchaseRecordId), ...filter }),
            this.timestamped(update),
            { ...options, returnDocument: 'after' }
        )
    }
}
