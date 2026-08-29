import { CrudRepository, ensure, leanArrayToPublic, leanOneToPublic } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ClientSession, Model } from 'mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from '#config'
import { CreatePurchaseRecordDto } from './dtos/index.js'
import { PurchaseEventStatus, PurchaseRecord, PurchaseRecordStatus } from './models/index.js'

@Injectable()
export class PurchaseRecordsRepository extends CrudRepository<PurchaseRecord> {
    constructor(
        @InjectModel(PurchaseRecord.name, MONGO_CONNECTION_NAME)
        readonly model: Model<PurchaseRecord>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize, config.http.paginationMaxSize)
    }

    async findByUserId(userId: string) {
        const purchaseRecords = await this.model
            // status가 생기기 전에 저장된 기록도 완료된 구매로 취급한다.
            .find({ status: { $in: [PurchaseRecordStatus.Completed, null] }, userId })
            .sort({ createdAt: -1 })
            .lean()
            .exec()

        return leanArrayToPublic<PurchaseRecord>(purchaseRecords)
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

        await purchaseRecord.save()

        return purchaseRecord.toJSON()
    }

    async findByIdempotencyKey(userId: string, idempotencyKey: string) {
        const record = await this.model.findOne({ idempotencyKey, userId }).lean().exec()
        return leanOneToPublic<PurchaseRecord>(record)
    }

    async findPendingBefore(before: Date, now: Date) {
        const purchaseRecords = await this.model
            .find({
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
            .sort({ updatedAt: 1 })
            .limit(100)
            .lean()
            .exec()

        return leanArrayToPublic<PurchaseRecord>(purchaseRecords)
    }

    async findPendingById(purchaseRecordId: string) {
        const record = await this.model
            .findOne({ _id: purchaseRecordId, status: PurchaseRecordStatus.Pending })
            .lean()
            .exec()

        return leanOneToPublic<PurchaseRecord>(record)
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
            before: Date
            leaseUntil: Date
            now: Date
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
        const record = await this.model
            .findOneAndUpdate(
                { _id: purchaseRecordId, $or: candidates },
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
                },
                { returnDocument: 'after' }
            )
            .lean()
            .exec()

        return leanOneToPublic<PurchaseRecord>(record)
    }

    async findByPaymentId(paymentId: string) {
        const purchaseRecord = await this.model.findOne({ paymentId }).lean().exec()
        return leanOneToPublic<PurchaseRecord>(purchaseRecord)
    }

    async findUnpublishedBefore(before: Date, now: Date) {
        const purchaseRecords = await this.model
            .find({
                purchaseEventStatus: PurchaseEventStatus.Pending,
                status: PurchaseRecordStatus.Completed,
                updatedAt: { $lte: before },
                $or: [
                    { purchaseEventPublicationLeaseUntil: null },
                    { purchaseEventPublicationLeaseUntil: { $lte: now } }
                ]
            })
            .sort({ updatedAt: 1 })
            .limit(100)
            .lean()
            .exec()

        return leanArrayToPublic<PurchaseRecord>(purchaseRecords)
    }

    async claimEventPublication(
        purchaseRecordId: string,
        {
            before,
            leaseUntil,
            now,
            publicationId
        }: { before: Date; leaseUntil: Date; now: Date; publicationId: string }
    ) {
        const purchaseRecord = await this.model
            .findOneAndUpdate(
                {
                    _id: purchaseRecordId,
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
                },
                { returnDocument: 'after' }
            )
            .lean()
            .exec()

        return leanOneToPublic<PurchaseRecord>(purchaseRecord)
    }

    async claimForCompletion(
        purchaseRecordId: string,
        completionId: string,
        completionLeaseUntil: Date
    ) {
        const purchaseRecord = await this.model
            .findOneAndUpdate(
                { _id: purchaseRecordId, status: PurchaseRecordStatus.Pending },
                {
                    $set: {
                        completionId,
                        completionLeaseUntil,
                        status: PurchaseRecordStatus.Completing
                    }
                },
                { returnDocument: 'after' }
            )
            .lean()
            .exec()
        if (!purchaseRecord) {
            throw new Error(`Purchase record is no longer pending: ${purchaseRecordId}`)
        }

        return ensure(leanOneToPublic<PurchaseRecord>(purchaseRecord))
    }

    async markCompleted(
        purchaseRecordId: string,
        completionId: string,
        session: ClientSession | undefined = undefined,
        idempotencyResponse: object | undefined = undefined
    ) {
        const purchaseRecord = await this.model
            .findOneAndUpdate(
                { _id: purchaseRecordId, completionId, status: PurchaseRecordStatus.Completing },
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
                { returnDocument: 'after', session }
            )
            .lean()
            .exec()
        if (!purchaseRecord) {
            throw new Error(`Purchase completion lease was lost: ${purchaseRecordId}`)
        }

        return ensure(leanOneToPublic<PurchaseRecord>(purchaseRecord))
    }

    async setPaymentId(purchaseRecordId: string, paymentId: string) {
        const purchaseRecord = await this.model
            .findOneAndUpdate(
                { _id: purchaseRecordId, status: PurchaseRecordStatus.Pending },
                { $set: { paymentId } },
                { returnDocument: 'after' }
            )
            .lean()
            .exec()
        if (!purchaseRecord) {
            throw new Error(`Purchase record is no longer pending: ${purchaseRecordId}`)
        }

        return ensure(leanOneToPublic<PurchaseRecord>(purchaseRecord))
    }

    async markCancelled(purchaseRecordId: string, reconciliationId: string) {
        await this.model
            .updateOne(
                {
                    _id: purchaseRecordId,
                    reconciliationId,
                    status: PurchaseRecordStatus.Compensating
                },
                {
                    $set: {
                        reconciliationId: null,
                        reconciliationLeaseUntil: null,
                        status: PurchaseRecordStatus.Cancelled
                    }
                }
            )
            .exec()
    }

    async releaseReconciliationClaim(purchaseRecordId: string, reconciliationId: string) {
        await this.model
            .updateOne(
                {
                    _id: purchaseRecordId,
                    reconciliationId,
                    status: PurchaseRecordStatus.Compensating
                },
                { $set: { reconciliationLeaseUntil: new Date(0) } }
            )
            .exec()
    }

    async markEventPublished(purchaseRecordId: string, publicationId: string) {
        const result = await this.model
            .updateOne(
                {
                    _id: purchaseRecordId,
                    purchaseEventPublicationId: publicationId,
                    purchaseEventStatus: PurchaseEventStatus.Pending,
                    status: PurchaseRecordStatus.Completed
                },
                {
                    $set: {
                        purchaseEventPublicationId: null,
                        purchaseEventPublicationLeaseUntil: null,
                        purchaseEventStatus: PurchaseEventStatus.Published
                    }
                }
            )
            .exec()

        return result.modifiedCount === 1
    }

    async releaseEventPublicationClaim(purchaseRecordId: string, publicationId: string) {
        await this.model
            .updateOne(
                {
                    _id: purchaseRecordId,
                    purchaseEventPublicationId: publicationId,
                    purchaseEventStatus: PurchaseEventStatus.Pending,
                    status: PurchaseRecordStatus.Completed
                },
                {
                    $set: {
                        purchaseEventPublicationId: null,
                        purchaseEventPublicationLeaseUntil: null
                    }
                }
            )
            .exec()
    }
}
