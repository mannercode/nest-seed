import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { CreatePurchaseRecordDto, PurchaseRecordDto } from './dtos'
import { PurchaseRecord } from './models'
import { PurchaseRecordsRepository } from './purchase-records.repository'

@Injectable()
export class PurchaseRecordsService {
    constructor(private readonly repository: PurchaseRecordsRepository) {}

    async create(createDto: CreatePurchaseRecordDto) {
        const purchase = await this.repository.create(createDto)

        return this.toDto(purchase)
    }

    async getMany(purchaseIds: string[]) {
        const purchases = await this.repository.getByIds(purchaseIds)

        return this.toDtos(purchases)
    }

    private toDto(purchase: PurchaseRecord) {
        return this.toDtos([purchase])[0]
    }

    private toDtos(purchases: PurchaseRecord[]) {
        return purchases.map((purchase) =>
            mapDocToDto(purchase, PurchaseRecordDto, [
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
