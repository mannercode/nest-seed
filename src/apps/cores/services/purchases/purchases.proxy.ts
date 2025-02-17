import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { Routes } from 'shared/config'
import { PurchaseCreateDto, PurchaseDto } from './dtos'

@Injectable()
export class PurchasesProxy {
    constructor(@InjectClientProxy('clientProxy') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createPurchase(createDto: PurchaseCreateDto): Promise<PurchaseDto> {
        return getProxyValue(this.service.send(Routes.Messages.Purchases.createPurchase, createDto))
    }

    @MethodLog({ level: 'verbose' })
    getPurchase(purchaseId: string): Promise<PurchaseDto> {
        return getProxyValue(this.service.send(Routes.Messages.Purchases.getPurchase, purchaseId))
    }
}
