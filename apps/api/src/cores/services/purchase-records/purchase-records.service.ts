import { mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { CreatePurchaseRecordDto, PurchaseRecordDto } from './dtos'
import { PurchaseRecord } from './models'
import { PurchaseRecordsRepository } from './purchase-records.repository'

@Injectable()
export class PurchaseRecordsService {
    constructor(private readonly repository: PurchaseRecordsRepository) {}

    async deleteMany(purchaseRecordIds: string[]): Promise<void> {
        await this.repository.deleteByIds(purchaseRecordIds)
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
