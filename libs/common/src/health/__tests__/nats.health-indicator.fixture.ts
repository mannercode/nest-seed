import { createTestContext } from '@mannercode/testing'
import { getNatsConnectionToken, NatsModule, type NatsConnection } from '../../nats'
import { NatsHealthIndicator } from '../nats.health-indicator'

export type NatsHealthIndicatorFixture = {
    connection: NatsConnection
    natsIndicator: NatsHealthIndicator
    teardown: () => Promise<void>
}

export async function createNatsHealthIndicatorFixture() {
    const { close, module } = await createTestContext({
        imports: [NatsModule.forRoot(JSON.parse(process.env.TESTLIB_NATS_OPTIONS as string))],
        providers: [NatsHealthIndicator]
    })

    const natsIndicator = module.get(NatsHealthIndicator)
    const connection = module.get(getNatsConnectionToken())

    const teardown = async () => {
        await close()
    }

    return { connection, natsIndicator, teardown }
}
