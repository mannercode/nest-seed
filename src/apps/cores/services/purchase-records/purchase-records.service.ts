import { mapDocToDto } from '@mannercode/nest-common'
import { Injectable } from '@nestjs/common'
import { CreatePurchaseRecordDto } from './dtos'
import { PurchaseRecordDto } from './dtos'
import { PurchaseRecord } from './models'
import { PurchaseRecordsRepository } from './purchase-records.repository'

@Injectable()
export class PurchaseRecordsService {
    constructor(private readonly repository: PurchaseRecordsRepository) {}

    async delete(purchaseRecordId: string) {
        await this.repository.delete(purchaseRecordId)
    }

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
