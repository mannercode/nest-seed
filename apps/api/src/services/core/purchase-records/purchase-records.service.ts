import type { ClientSession } from 'mongodb'
import { DateUtil, ensure, mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { CreatePurchaseRecordDto, PurchaseRecordDto } from './dtos/index.js'
import { PurchaseRecord, PurchaseRecordStatus } from './models/index.js'
import { PurchaseRecordsRepository } from './purchase-records.repository.js'

@Injectable()
export class PurchaseRecordsService {
    constructor(private readonly repository: PurchaseRecordsRepository) {}

    async create(
        createDto: CreatePurchaseRecordDto,
        {
            idempotency,
            pending = false
        }: { idempotency?: { fingerprint: string; key: string }; pending?: boolean } = {}
    ) {
        const status = pending ? PurchaseRecordStatus.Pending : PurchaseRecordStatus.Completed
        const purchaseRecord = await this.repository.create(
            {
                ...createDto,
                idempotencyFingerprint: idempotency?.fingerprint,
                idempotencyKey: idempotency?.key
            },
            status
        )

        return this.toDto(purchaseRecord)
    }

    async findIdempotencyOperation(userId: string, idempotencyKey: string) {
        const record = await this.repository.findByIdempotencyKey(userId, idempotencyKey)
        if (!record) return undefined

        return {
            errorResponse: record.idempotencyErrorResponse,
            errorStatus: record.idempotencyErrorStatus,
            fingerprint: record.idempotencyFingerprint,
            response: record.idempotencyResponse
                ? (record.idempotencyResponse as unknown as PurchaseRecordDto)
                : undefined,
            purchaseRecord: this.toDto(record),
            status: record.status
        }
    }

    async findPendingById(purchaseRecordId: string) {
        const record = await this.repository.findPendingById(purchaseRecordId)
        return record ? this.toDto(record) : undefined
    }

    async getStatusById(purchaseRecordId: string) {
        const record = await this.repository.getById(purchaseRecordId)
        return record.status
    }

    async findPendingBefore(before: Temporal.Instant) {
        const records = await this.repository.findPendingBefore(before, DateUtil.now())
        return this.toDtos(records)
    }

    async claimForReconciliation(
        purchaseRecordId: string,
        options: {
            before: Temporal.Instant
            leaseUntil: Temporal.Instant
            now: Temporal.Instant
            reconciliationId: string
            completionId?: string
            idempotencyError?: { response: Record<string, unknown>; status: number }
        }
    ) {
        const record = await this.repository.claimForReconciliation(purchaseRecordId, options)
        return record ? this.toDto(record) : undefined
    }

    async findUnpublishedBefore(before: Temporal.Instant) {
        const records = await this.repository.findUnpublishedBefore(before, DateUtil.now())
        return this.toDtos(records)
    }

    async claimEventPublication(
        purchaseRecordId: string,
        options: {
            before: Temporal.Instant
            leaseUntil: Temporal.Instant
            now: Temporal.Instant
            publicationId: string
        }
    ) {
        const record = await this.repository.claimEventPublication(purchaseRecordId, options)
        return record ? this.toDto(record) : undefined
    }

    async claimForCompletion(
        purchaseRecordId: string,
        completionId: string,
        completionLeaseUntil: Temporal.Instant
    ) {
        const purchaseRecord = await this.repository.claimForCompletion(
            purchaseRecordId,
            completionId,
            completionLeaseUntil
        )
        return this.toDto(purchaseRecord)
    }

    async markCompleted(
        purchaseRecordId: string,
        completionId: string,
        session: ClientSession | undefined = undefined,
        idempotencyResponse: PurchaseRecordDto | undefined = undefined
    ) {
        const purchaseRecord = await this.repository.markCompleted(
            purchaseRecordId,
            completionId,
            session,
            idempotencyResponse
        )
        return this.toDto(purchaseRecord)
    }

    async setPaymentId(purchaseRecordId: string, paymentId: string) {
        const purchaseRecord = await this.repository.setPaymentId(purchaseRecordId, paymentId)
        return this.toDto(purchaseRecord)
    }

    async markCancelled(purchaseRecordId: string, reconciliationId: string) {
        await this.repository.markCancelled(purchaseRecordId, reconciliationId)
    }

    async releaseReconciliationClaim(purchaseRecordId: string, reconciliationId: string) {
        await this.repository.releaseReconciliationClaim(purchaseRecordId, reconciliationId)
    }

    async markEventPublished(purchaseRecordId: string, publicationId: string) {
        return this.repository.markEventPublished(purchaseRecordId, publicationId)
    }

    async releaseEventPublicationClaim(purchaseRecordId: string, publicationId: string) {
        await this.repository.releaseEventPublicationClaim(purchaseRecordId, publicationId)
    }

    async findByUserId(userId: string) {
        const purchaseRecords = await this.repository.findByUserId(userId)

        return this.toDtos(purchaseRecords)
    }

    private toDto(purchaseRecord: PurchaseRecord) {
        return ensure(this.toDtos([purchaseRecord])[0])
    }

    private toDtos(purchaseRecords: PurchaseRecord[]) {
        return purchaseRecords.map((purchaseRecord) =>
            mapDocToDto(purchaseRecord, PurchaseRecordDto, [
                'id',
                'userId',
                'paymentId',
                'totalPrice',
                'purchaseItems',
                'createdAt',
                'updatedAt'
            ])
        )
    }
}
