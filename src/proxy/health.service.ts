import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue } from 'common'

@Injectable()
export class HealthService {
    constructor(private service: ClientProxyService) {}

    check() {
        return getProxyValue(this.service.send('health.check', {}))
    }
}
