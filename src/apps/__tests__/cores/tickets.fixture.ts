import { TicketsClient, TicketsModule } from 'apps/cores'
import { createAppTestContext } from '../__helpers__'
import type { AppTestContext } from '../__helpers__'

export type TicketsFixture = AppTestContext & { ticketsClient: TicketsClient }

export async function createTicketsFixture() {
    const ctx = await createAppTestContext({ imports: [TicketsModule], providers: [TicketsClient] })

    const ticketsClient = ctx.module.get(TicketsClient)

    return { ...ctx, ticketsClient }
}
