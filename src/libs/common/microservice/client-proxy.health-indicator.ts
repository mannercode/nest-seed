import { Injectable } from '@nestjs/common'
import { HealthCheckError, HealthIndicator } from '@nestjs/terminus'
import { ClientProxyService } from '../microservice'
import { lastValueFrom } from 'rxjs'

@Injectable()
export class ClientProxyHealthIndicator extends HealthIndicator {
    constructor() {
        super()
    }

    async pingCheck(key: string, proxy: ClientProxyService) {
        try {
            const result = await lastValueFrom<{ status: string }>(proxy.send('health', {}))

            if (result.status === 'ok') {
                return this.getStatus(key, true)
            }

            /* istanbul ignore next */
            throw new Error('ClientProxy ping failed')
        } catch (_error) {
            /* istanbul ignore next */
            throw new HealthCheckError('ProxyHealthIndicator failed', this.getStatus(key, false))
        }
    }
}
