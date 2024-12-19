import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { PurchaseCreateDto, PurchaseDto } from 'cores'

@Injectable()
export class PurchasesService {
    constructor(@InjectClientProxy('SERVICES_CLIENT') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createPurchase(createDto: PurchaseCreateDto): Promise<PurchaseDto> {
        return getProxyValue(this.service.send('createPurchase', createDto))
    }

    @MethodLog({ level: 'verbose' })
    getPurchase(purchaseId: string): Promise<PurchaseDto> {
        return getProxyValue(this.service.send('getPurchase', purchaseId))
    }
}
