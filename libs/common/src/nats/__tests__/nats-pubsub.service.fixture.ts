import { createTestContext, getNatsTestConnection } from '@mannercode/testing'
import type { NatsConnection } from '../nats.types'
import { NatsPubSubModule, NatsPubSubService } from '../nats-pubsub.service'
import { NatsModule } from '../nats.module'
import { getNatsConnectionToken } from '../nats.tokens'

export type NatsPubSubServiceFixture = {
    pubSubA: NatsPubSubService
    pubSubB: NatsPubSubService
    teardown: () => Promise<void>
}

/**
 * Two NatsPubSubService instances that share the same NATS server so we can
 * drive a cross-replica scenario (A publishes, B subscribes — or both do).
 */
export async function createNatsPubSubServiceFixture(): Promise<NatsPubSubServiceFixture> {
    const contextA = await createTestContext({
        imports: [
            NatsModule.forRootAsync({ useFactory: () => getNatsTestConnection() }, 'replicaA'),
            NatsPubSubModule.register({ name: 'replicaA', natsName: 'replicaA' })
        ]
    })

    const contextB = await createTestContext({
        imports: [
            NatsModule.forRootAsync({ useFactory: () => getNatsTestConnection() }, 'replicaB'),
            NatsPubSubModule.register({ name: 'replicaB', natsName: 'replicaB' })
        ]
    })

    const pubSubA = contextA.module.get<NatsPubSubService>(NatsPubSubService.getName('replicaA'))
    const pubSubB = contextB.module.get<NatsPubSubService>(NatsPubSubService.getName('replicaB'))

    const ncA = contextA.module.get<NatsConnection>(getNatsConnectionToken('replicaA'))
    const ncB = contextB.module.get<NatsConnection>(getNatsConnectionToken('replicaB'))

    const teardown = async () => {
        await contextA.close()
        await contextB.close()
        await ncA.drain().catch(() => undefined)
        await ncB.drain().catch(() => undefined)
    }

    return { pubSubA, pubSubB, teardown }
}
