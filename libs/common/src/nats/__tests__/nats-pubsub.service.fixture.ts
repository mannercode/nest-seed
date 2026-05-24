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
 * 같은 NATS 서버를 함께 쓰는 `NatsPubSubService` 인스턴스 두 개를 시작한다.
 * 한 인스턴스가 발행하고 다른 인스턴스가 구독하는 방식으로, 복제본 사이로 메시지가 흐르는 시나리오를 재현하기 위한 픽스처이다.
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

    // 두 연결이 서버와 왕복 가능한 상태인지 확인한다.
    // 이후 테스트의 timeout 범위에는 컨테이너 콜드 스타트나 TCP 핸드셰이크 비용이 포함되지 않고, 순수 메시지 왕복 시간만 들어간다.
    await Promise.all([ncA.flush(), ncB.flush()])

    const teardown = async () => {
        await contextA.close()
        await contextB.close()
        await ncA.drain().catch(() => undefined)
        await ncB.drain().catch(() => undefined)
    }

    return { pubSubA, pubSubB, teardown }
}
