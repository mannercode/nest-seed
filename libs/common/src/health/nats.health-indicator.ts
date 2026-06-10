import type { NatsConnection } from 'nats'
import { Injectable } from '@nestjs/common'
import { HealthIndicatorService } from '@nestjs/terminus'
import { getByPath } from '../utils'

@Injectable()
export class NatsHealthIndicator {
    constructor(private readonly healthIndicatorService: HealthIndicatorService) {}

    async isHealthy(key: string, connection: NatsConnection) {
        const indicator = this.healthIndicatorService.check(key)

        try {
            // flush는 서버 왕복을 보장하므로 살아 있는 연결에서만 성공한다.
            await connection.flush()

            return indicator.up()
        } catch (error: unknown) {
            const reason = getByPath(error, 'message', String(error))
            return indicator.down({ reason })
        }
    }
}
