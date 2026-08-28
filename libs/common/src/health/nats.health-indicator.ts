import { Injectable } from '@nestjs/common'
import type { NatsConnection } from '../nats'
import { getByPath } from '../utils'

@Injectable()
export class NatsHealthIndicator {
    async isHealthy(key: string, connection: NatsConnection) {
        try {
            // flush는 서버 왕복을 보장하므로 살아 있는 연결에서만 성공한다.
            await connection.flush()

            return { [key]: { status: 'up' as const } }
        } catch (error: unknown) {
            const reason = getByPath(error, 'message', String(error))
            return { [key]: { reason, status: 'down' as const } }
        }
    }
}
