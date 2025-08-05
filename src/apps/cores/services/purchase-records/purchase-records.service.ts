import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { CreatePurchaseRecordDto, PurchaseRecordDto } from './dtos'
import { PurchaseRecordDocument } from './models'
import { PurchasesRecordRepository } from './purchase-records.repository'

@Injectable()
export class PurchaseRecordsService {
    constructor(private repository: PurchasesRecordRepository) {}

    async createPurchseRecord(createDto: CreatePurchaseRecordDto) {
        const purchase = await this.repository.createPurchseRecord(createDto)

        return this.toDto(purchase)
    }

    async getPurchases(purchaseIds: string[]) {
        const purchases = await this.repository.getByIds(purchaseIds)

        return this.toDtos(purchases)
    }

    private toDto = (purchase: PurchaseRecordDocument) =>
        mapDocToDto(purchase, PurchaseRecordDto, [
            'id',
            'customerId',
            'paymentId',
            'totalPrice',
            'purchaseItems',
            'createdAt',
            'updatedAt'
        ])

    private toDtos = (purchases: PurchaseRecordDocument[]) =>
        purchases.map((purchase) => this.toDto(purchase))
}
