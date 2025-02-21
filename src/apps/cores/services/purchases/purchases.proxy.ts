import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { ClientProxyConfig, Subjects } from 'shared/config'
import { PurchaseCreateDto, PurchaseDto } from './dtos'

@Injectable()
export class PurchasesProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    createPurchase(createDto: PurchaseCreateDto): Promise<PurchaseDto> {
        return getProxyValue(this.service.send(Subjects.Purchases.createPurchase, createDto))
    }

    @MethodLog({ level: 'verbose' })
    getPurchase(purchaseId: string): Promise<PurchaseDto> {
        return getProxyValue(this.service.send(Subjects.Purchases.getPurchase, purchaseId))
    }
}
