import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, MethodLog } from 'common'
import { PurchaseCreateDto, PurchaseDto } from 'types'

@Injectable()
export class PurchaseProcessService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    processPurchase(createDto: PurchaseCreateDto): Promise<PurchaseDto> {
        return getProxyValue(this.service.send('processPurchase', createDto))
    }
}
