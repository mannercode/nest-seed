import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { CreatePurchaseRecordDto, PurchaseRecordDto } from './dtos'
import { PurchaseRecordDocument } from './models'
import { PurchasesRecordRepository } from './purchase-records.repository'

@Injectable()
export class PurchaseRecordsService {
    constructor(private readonly repository: PurchasesRecordRepository) {}

    async create(createDto: CreatePurchaseRecordDto) {
        const purchase = await this.repository.create(createDto)

        return this.toDto(purchase)
    }

    async getMany(purchaseIds: string[]) {
        const purchases = await this.repository.getByIds(purchaseIds)

        return this.toDtos(purchases)
    }

    private toDto(purchase: PurchaseRecordDocument) {
        return mapDocToDto(purchase, PurchaseRecordDto, [
            'id',
            'customerId',
            'paymentId',
            'totalPrice',
            'purchaseItems',
            'createdAt',
            'updatedAt'
        ])
    }

    private toDtos(purchases: PurchaseRecordDocument[]) {
        return purchases.map((purchase) => this.toDto(purchase))
    }
}
