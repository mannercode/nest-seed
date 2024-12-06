import { Injectable } from '@nestjs/common'
import { mapDocToDto, MethodLog } from 'common'
import { PurchaseCreateDto, PurchaseDto } from './dtos'
import { PurchaseDocument } from './models'
import { PurchasesRepository } from './purchases.repository'

@Injectable()
export class PurchasesService {
    constructor(private repository: PurchasesRepository) {}

    @MethodLog()
    async processPurchase(createDto: PurchaseCreateDto) {
        const purchase = await this.repository.createPurchase(createDto)

        return this.toDto(purchase)
    }

    @MethodLog({ level: 'verbose' })
    async getPurchase(purchaseId: string) {
        const purchase = await this.repository.getById(purchaseId)

        return this.toDto(purchase)
    }

    private toDto = (purchase: PurchaseDocument) =>
        mapDocToDto(purchase, PurchaseDto, [
            'id',
            'customerId',
            'totalPrice',
            'items',
            'createdAt',
            'updatedAt'
        ])
}
