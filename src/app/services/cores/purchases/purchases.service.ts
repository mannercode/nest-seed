import { Injectable } from '@nestjs/common'
import { mapDocToDto, MethodLog } from 'common'
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
