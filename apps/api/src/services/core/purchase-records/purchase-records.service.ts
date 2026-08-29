import type { ClientSession } from 'mongodb'
import { ensure, mapDocToDto } from '@mannercode/common'
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

    async findStatusById(purchaseRecordId: string) {
        const record = await this.repository.findById(purchaseRecordId)
        if (!record) return undefined

        return this.getLegacyCompatibleStatus(record)
    }

    async findResolutionByPaymentId(paymentId: string) {
        const record = await this.repository.findByPaymentId(paymentId)
        if (!record) return undefined

        return { purchaseRecordId: record.id, status: this.getLegacyCompatibleStatus(record) }
    }

    async findPendingBefore(before: Date) {
        const records = await this.repository.findPendingBefore(before, new Date())
        return this.toDtos(records)
    }

    async claimForReconciliation(
        purchaseRecordId: string,
        options: {
            before: Date
            leaseUntil: Date
            now: Date
            reconciliationId: string
            completionId?: string
            idempotencyError?: { response: Record<string, unknown>; status: number }
        }
    ) {
        const record = await this.repository.claimForReconciliation(purchaseRecordId, options)
        return record ? this.toDto(record) : undefined
    }

    async findUnpublishedBefore(before: Date) {
        const records = await this.repository.findUnpublishedBefore(before, new Date())
        return this.toDtos(records)
    }

    async claimEventPublication(
        purchaseRecordId: string,
        options: { before: Date; leaseUntil: Date; now: Date; publicationId: string }
    ) {
        const record = await this.repository.claimEventPublication(purchaseRecordId, options)
        return record ? this.toDto(record) : undefined
    }

    async claimForCompletion(
        purchaseRecordId: string,
        completionId: string,
        completionLeaseUntil: Date
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

    private getLegacyCompatibleStatus(record: PurchaseRecord) {
        // status 도입 전 raw 문서는 런타임에는 undefined일 수 있다.
        const { status } = record as Partial<Pick<PurchaseRecord, 'status'>>
        return status ?? PurchaseRecordStatus.Completed
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
