import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { PaymentsProxy } from 'infrastructures'
import { PurchaseCreateDto, PurchaseDto } from './dtos'
import { PurchaseDocument } from './models'
import { PurchasesRepository } from './purchases.repository'

@Injectable()
export class PurchasesService {
    constructor(
        private repository: PurchasesRepository,
        private paymentsService: PaymentsProxy
    ) {}

    async createPurchase(createDto: PurchaseCreateDto) {
        const payment = await this.paymentsService.processPayment({
            customerId: createDto.customerId,
            amount: createDto.totalPrice
        })

        const purchase = await this.repository.createPurchase({
            ...createDto,
            paymentId: payment.id
        })

        return this.toDto(purchase)
    }

    async getPurchase(purchaseId: string) {
        const purchase = await this.repository.getById(purchaseId)

        return this.toDto(purchase)
    }

    private toDto = (purchase: PurchaseDocument) =>
        mapDocToDto(purchase, PurchaseDto, [
            'id',
            'customerId',
            'paymentId',
            'totalPrice',
            'items',
            'createdAt',
            'updatedAt'
        ])
}
