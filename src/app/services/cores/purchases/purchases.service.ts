import { Injectable } from '@nestjs/common'
import { EventService, mapDocToDto, MethodLog, objectId } from 'common'
import { PaymentsService } from 'services/infrastructures'
import { PurchaseCreateDto, PurchaseDto } from './dtos'
import { PurchaseDocument } from './models'
import { PurchasesRepository } from './purchases.repository'
import { PurchaseCreatedEvent } from './purchases.events'

@Injectable()
export class PurchasesService {
    constructor(
        private repository: PurchasesRepository,
        private paymentsService: PaymentsService,
        private eventService: EventService
    ) {
        // await eventService.emit(new SampleEvent('event'))
    }

    // @OnEvent(SampleEvent.eventName)
    // onSampleEvent(_: SampleEvent): void {}

    @MethodLog()
    async processPurchase(createDto: PurchaseCreateDto) {
        const purchase = await this.repository.createPurchase(createDto)

        const createdEvent = new PurchaseCreatedEvent()
        await this.eventService.emit(createdEvent)

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
