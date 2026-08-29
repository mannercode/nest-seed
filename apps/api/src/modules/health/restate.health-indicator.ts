import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'

@Injectable()
export class RestateHealthIndicator {
    constructor(private readonly config: AppConfigService) {}

    async isHealthy(key: string) {
        try {
            const response = await fetch(`${this.config.restate.ingressUrl}/restate/health`, {
                signal: AbortSignal.timeout(2_000)
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            return { [key]: { status: 'up' as const } }
        } catch (error: unknown) {
            const reason = error instanceof Error ? error.message : String(error)
            return { [key]: { reason, status: 'down' as const } }
        }
    }
}
