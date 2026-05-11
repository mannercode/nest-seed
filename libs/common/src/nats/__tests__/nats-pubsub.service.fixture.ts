import { createTestContext } from '@mannercode/testing'
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
 * 같은 NATS 서버를 함께 쓰는 `NatsPubSubService` 인스턴스 두 개를 시작합니다.
 * 한 인스턴스가 발행하고 다른 인스턴스가 구독하는 방식으로, 복제본 사이로 메시지가
 * 흐르는 시나리오를 재현하기 위한 fixture입니다.
 */
export async function createNatsPubSubServiceFixture(): Promise<NatsPubSubServiceFixture> {
    const contextA = await createTestContext({
        imports: [
            NatsModule.forRootAsync(
                { useFactory: () => JSON.parse(process.env.TESTLIB_NATS_OPTIONS as string) },
                'replicaA'
            ),
            NatsPubSubModule.register({ name: 'replicaA', natsName: 'replicaA' })
        ]
    })

    const contextB = await createTestContext({
        imports: [
            NatsModule.forRootAsync(
                { useFactory: () => JSON.parse(process.env.TESTLIB_NATS_OPTIONS as string) },
                'replicaB'
            ),
            NatsPubSubModule.register({ name: 'replicaB', natsName: 'replicaB' })
        ]
    })

    const pubSubA = contextA.module.get<NatsPubSubService>(NatsPubSubService.getName('replicaA'))
    const pubSubB = contextB.module.get<NatsPubSubService>(NatsPubSubService.getName('replicaB'))

    const ncA = contextA.module.get<NatsConnection>(getNatsConnectionToken('replicaA'))
    const ncB = contextB.module.get<NatsConnection>(getNatsConnectionToken('replicaB'))

    // 두 connection이 server와 round-trip 가능한 상태임을 확인.
    // 이후 spec의 timeout 윈도우에 testcontainer 콜드스타트 / TCP handshake
    // 비용이 포함되지 않고, 순수 메시지 round-trip만 측정됨.
    await Promise.all([ncA.flush(), ncB.flush()])

    const teardown = async () => {
        await contextA.close()
        await contextB.close()
        await ncA.drain().catch(() => undefined)
        await ncB.drain().catch(() => undefined)
    }

    return { pubSubA, pubSubB, teardown }
}
