import { createTestContext } from '@mannercode/testing'
import type { NatsConnection } from '../nats.types'
import { getNatsTestConnection } from '../../infra-connections'
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

    // 두 connection 이 server 와 round-trip 가능한 상태임을 증명.
    // 이후 spec 의 timeout 윈도우에 testcontainer 콜드스타트 / TCP handshake
    // 비용이 끼어들지 않고, 순수 메시지 round-trip 만 측정됨.
    await Promise.all([ncA.flush(), ncB.flush()])

    const teardown = async () => {
        await contextA.close()
        await contextB.close()
        await ncA.drain().catch(() => undefined)
        await ncB.drain().catch(() => undefined)
    }

    return { pubSubA, pubSubB, teardown }
}
