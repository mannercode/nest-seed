import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy } from 'common'

@Injectable()
export class HealthProxy {
    constructor(@InjectClientProxy('INFRASTRUCTURES_CLIENT') private service: ClientProxyService) {}

    check() {
        return getProxyValue(this.service.send('health.check', {}))
    }
}
