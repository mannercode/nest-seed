import { Injectable } from '@nestjs/common'
import { ClientProxyService } from 'common'

@Injectable()
export class HealthService {
    constructor(private service: ClientProxyService) {}

    check() {
        return this.service.send('health.check', {})
    }
}
