import type { Connection } from '@temporalio/client'
import { createTestContext } from '@mannercode/testing'
import { HealthIndicatorService } from '@nestjs/terminus'
import { getTemporalConnectionToken, TemporalClientModule } from '../../temporal'
import { TemporalHealthIndicator } from '../temporal.health-indicator'

export type TemporalHealthIndicatorFixture = {
    connection: Connection
    temporalIndicator: TemporalHealthIndicator
    teardown: () => Promise<void>
}

export async function createTemporalHealthIndicatorFixture() {
    const { close, module } = await createTestContext({
        imports: [
            TemporalClientModule.forRootAsync({
                useFactory: () => ({
                    address: process.env.TESTLIB_TEMPORAL_ADDRESS as string,
                    namespace: process.env.TESTLIB_TEMPORAL_NAMESPACE as string
                })
            })
        ],
        providers: [TemporalHealthIndicator, HealthIndicatorService]
    })

    const temporalIndicator = module.get(TemporalHealthIndicator)
    const connection = module.get<Connection>(getTemporalConnectionToken())

    const teardown = async () => {
        await close()
    }

    return { connection, temporalIndicator, teardown }
}
