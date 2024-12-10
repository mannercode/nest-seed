import { Injectable } from '@nestjs/common'
import { mapDocToDto, MethodLog, objectId } from 'common'
import { PaymentsService } from 'services/infrastructures'
import { PurchaseCreateDto, PurchaseDto } from './dtos'
import { PurchaseDocument } from './models'
import { PurchasesRepository } from './purchases.repository'

@Injectable()
export class PurchasesService {
    constructor(
        private repository: PurchasesRepository,
        private paymentsService: PaymentsService
    ) {}

    @MethodLog()
    async processPurchase(createDto: PurchaseCreateDto) {
        const purchase = await this.repository.createPurchase(createDto)

        const payment = await this.paymentsService.processPayment({
            customerId: purchase.customerId.toString(),
            amount: purchase.totalPrice
        })

        purchase.paymentId = objectId(payment.id)
        await purchase.save()

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
            'paymentId',
            'totalPrice',
            'items',
            'createdAt',
            'updatedAt'
        ])
}
