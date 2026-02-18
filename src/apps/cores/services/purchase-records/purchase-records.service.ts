import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import type { CreatePurchaseRecordDto } from './dtos'
import type { PurchaseRecord } from './models'
import type { PurchaseRecordsRepository } from './purchase-records.repository'
import { PurchaseRecordDto } from './dtos'

@Injectable()
export class PurchaseRecordsService {
    constructor(private readonly repository: PurchaseRecordsRepository) {}

    async create(createDto: CreatePurchaseRecordDto) {
        const purchaseRecord = await this.repository.create(createDto)

        return this.toDto(purchaseRecord)
    }

    async getMany(purchaseRecordIds: string[]) {
        const purchaseRecords = await this.repository.getByIds(purchaseRecordIds)

        return this.toDtos(purchaseRecords)
    }

    private toDto(purchaseRecord: PurchaseRecord) {
        return this.toDtos([purchaseRecord])[0]
    }

    private toDtos(purchaseRecords: PurchaseRecord[]) {
        return purchaseRecords.map((purchaseRecord) =>
            mapDocToDto(purchaseRecord, PurchaseRecordDto, [
                'id',
                'customerId',
                'paymentId',
                'totalPrice',
                'purchaseItems',
                'createdAt',
                'updatedAt'
            ])
        )
    }
}
