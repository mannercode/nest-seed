import {
    getNatsConnectionToken,
    type DurableMessages,
    type NatsConnection
} from '@mannercode/common'
import { jetstreamManager } from '@nats-io/jetstream'
import type { MockInstance } from 'vitest'
import { PurchaseEvents } from '#application'
import { NATS_CONNECTION_NAME } from '#config'
import type { AppTestContext } from '../helpers/index.js'

export const NOTIFICATION_LOG = 'would send purchase confirmation'

export function getNotificationLogs(logSpy: MockInstance) {
    return logSpy.mock.calls.filter(([message]) => message === NOTIFICATION_LOG)
}

export async function getJetStream(ctx: AppTestContext) {
    const events = ctx.module.get(PurchaseEvents)
    const connection = ctx.module.get<NatsConnection>(getNatsConnectionToken(NATS_CONNECTION_NAME))
    const manager = await jetstreamManager(connection)
    const streamName = await manager.streams.find(events.subjects.purchased)
    return { connection, manager, streamName }
}

export async function waitForNotifications(ctx: AppTestContext, timeoutMs = 2000) {
    const { manager, streamName } = await getJetStream(ctx)
    // 로그 출력 뒤의 ack/term까지 서버가 반영했는지 확인한다.
    await waitFor(async () => {
        const consumers = await manager.consumers.list(streamName).next()
        return (
            consumers.length === 1 &&
            consumers.every(
                (consumer) => consumer.num_pending === 0 && consumer.num_ack_pending === 0
            )
        )
    }, timeoutMs)
}

export function mockNotificationMessages(
    ctx: AppTestContext,
    iterator: () => AsyncGenerator<never, void, unknown>,
    onClose: () => void = () => undefined
) {
    const messages = {
        [Symbol.asyncIterator]: iterator,
        close: vi.fn(async () => onClose())
    } satisfies DurableMessages
    vi.spyOn(ctx.module.get(PurchaseEvents), 'consumeNotifications').mockResolvedValueOnce(messages)
    return messages
}

/**
 * `predicate`가 true가 되거나 `timeoutMs`가 지날 때까지 짧은 간격으로 다시 확인한다.
 * NATS 전달은 비동기라서, `emit` 직후에 즉시 단언할 수 없다.
 */
export async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 2000) {
    const start = performance.now()
    while (!(await predicate())) {
        if (performance.now() - start > timeoutMs) {
            throw new Error(`waitFor timed out after ${timeoutMs}ms`)
        }
        await new Promise((r) => setTimeout(r, 10))
    }
}
