import type { Connection } from '@temporalio/client'
import { Injectable } from '@nestjs/common'
import { HealthIndicatorService } from '@nestjs/terminus'
import { getByPath } from '../utils'

// grpc.health.v1.HealthCheckResponse.ServingStatus.SERVING
const SERVING = 1

@Injectable()
export class TemporalHealthIndicator {
    constructor(private readonly healthIndicatorService: HealthIndicatorService) {}

    async isHealthy(key: string, connection: Connection) {
        const indicator = this.healthIndicatorService.check(key)

        try {
            const response = await connection.healthService.check({})

            if (response.status !== SERVING) {
                return indicator.down({ servingStatus: String(response.status) })
            }

            return indicator.up()
        } catch (error: unknown) {
            const reason = getByPath(error, 'message', String(error))
            return indicator.down({ reason })
        }
    }
}
