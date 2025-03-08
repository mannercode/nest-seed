import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, MethodLog } from 'common'
import { ClientProxyConfig, Messages } from 'shared/config'
import { PurchaseCreateDto, PurchaseDto } from './dtos'

@Injectable()
export class PurchasesProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    createPurchase(createDto: PurchaseCreateDto): Promise<PurchaseDto> {
        return this.service.getJson(Messages.Purchases.createPurchase, createDto)
    }

    @MethodLog({ level: 'verbose' })
    getPurchase(purchaseId: string): Promise<PurchaseDto> {
        return this.service.getJson(Messages.Purchases.getPurchase, purchaseId)
    }
}
