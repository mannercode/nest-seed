import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, MethodLog } from 'common'
import { PurchaseCreateDto, PurchaseDto } from 'types'

@Injectable()
export class PurchasesService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createPurchase(createDto: PurchaseCreateDto): Promise<PurchaseDto> {
        return getProxyValue(this.service.send('createPurchase', createDto))
    }

    @MethodLog({ level: 'verbose' })
    getPurchase(purchaseId: string): Promise<PurchaseDto> {
        return getProxyValue(this.service.send('getPurchase', purchaseId))
    }
}
