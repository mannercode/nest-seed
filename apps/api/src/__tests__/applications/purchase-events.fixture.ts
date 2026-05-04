import {
    PurchaseEventLoggerService,
    PurchaseEvents,
    PurchaseModule,
    PurchaseNotificationService
} from 'applications'
import { createAppTestContext, type AppTestContext } from '../__helpers__'

export type PurchaseEventsFixture = AppTestContext & {
    events: PurchaseEvents
    notification: PurchaseNotificationService
    logger: PurchaseEventLoggerService
}

export async function createPurchaseEventsFixture(): Promise<PurchaseEventsFixture> {
    const ctx = await createAppTestContext({ imports: [PurchaseModule] })

    return {
        ...ctx,
        events: ctx.module.get(PurchaseEvents),
        notification: ctx.module.get(PurchaseNotificationService),
        logger: ctx.module.get(PurchaseEventLoggerService)
    }
}

/**
 * Polls until `predicate` returns true or `timeoutMs` elapses. NATS
 * delivery is async so we can't assert immediately after emit.
 */
export async function waitFor(predicate: () => boolean, timeoutMs = 2000) {
    const start = Date.now()
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error(`waitFor timed out after ${timeoutMs}ms`)
        }
        await new Promise((r) => setTimeout(r, 10))
    }
}
