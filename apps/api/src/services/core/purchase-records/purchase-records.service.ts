import { type TransactionContext, ensure, mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { CreatePurchaseRecordDto, PurchaseRecordDto, PurchaseRecordSchema } from './dtos/index.js'
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

    async findIdempotencyOperation({
        userId,
        idempotencyKey
    }: {
        userId: string
        idempotencyKey: string
    }) {
        const record = await this.repository.findByIdempotencyKey({ userId, idempotencyKey })
        if (!record) return undefined

        return {
            errorResponse: record.idempotencyErrorResponse,
            errorStatus: record.idempotencyErrorStatus,
            fingerprint: record.idempotencyFingerprint,
            response: record.idempotencyResponse
                ? PurchaseRecordSchema.parse(record.idempotencyResponse)
                : undefined,
            purchaseRecord: this.toDto(record),
            status: record.status
        }
    }

    async markCompleted(
        purchaseRecordId: string,
        response: PurchaseRecordDto,
        transaction: TransactionContext
    ) {
        return this.toDto(
            await this.repository.markCompleted(purchaseRecordId, response, transaction)
        )
    }

    async setPaymentId(purchaseRecordId: string, paymentId: string) {
        return this.toDto(await this.repository.setPaymentId(purchaseRecordId, paymentId))
    }

    async beginCompensation(
        purchaseRecordId: string,
        error: { response: Record<string, unknown>; status: number }
    ) {
        return this.repository.beginCompensation(purchaseRecordId, error)
    }

    async markCancelled(purchaseRecordId: string) {
        await this.repository.markCancelled(purchaseRecordId)
    }

    async findCompleted({ userId }: { userId: string }) {
        const purchaseRecords = await this.repository.findCompleted({ userId })

        return this.toDtos(purchaseRecords)
    }

    private toDto(purchaseRecord: PurchaseRecord) {
        return ensure(this.toDtos([purchaseRecord])[0])
    }

    private toDtos(purchaseRecords: PurchaseRecord[]) {
        return purchaseRecords.map((purchaseRecord) =>
            mapDocToDto(purchaseRecord, PurchaseRecordSchema)
        )
    }
}
