import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { PurchaseCreateDto, PurchaseDto } from 'cores'
import { ClientProxyConfig, Messages } from 'shared/config'

@Injectable()
export class PurchaseProcessProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    processPurchase(createDto: PurchaseCreateDto): Promise<PurchaseDto> {
        return getProxyValue(this.service.send(Messages.PurchaseProcess.processPurchase, createDto))
    }
}
