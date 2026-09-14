import { Injectable } from '@nestjs/common'

@Injectable()
export class RestateHealthIndicator {
    constructor(private readonly ingressUrl: string) {}

    async isHealthy(key: string) {
        try {
            const response = await fetch(`${this.ingressUrl}/restate/health`, {
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
