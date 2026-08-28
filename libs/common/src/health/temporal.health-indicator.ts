import type { Connection } from '@temporalio/client'
import { Injectable } from '@nestjs/common'
import { getByPath } from '../utils'

// grpc.health.v1.HealthCheckResponse.ServingStatus.SERVING
const SERVING = 1

@Injectable()
export class TemporalHealthIndicator {
    async isHealthy(key: string, connection: Connection) {
        try {
            const response = await connection.healthService.check({})

            if (response.status !== SERVING) {
                return {
                    [key]: { servingStatus: String(response.status), status: 'down' as const }
                }
            }

            return { [key]: { status: 'up' as const } }
        } catch (error: unknown) {
            const reason = getByPath(error, 'message', String(error))
            return { [key]: { reason, status: 'down' as const } }
        }
    }
}
