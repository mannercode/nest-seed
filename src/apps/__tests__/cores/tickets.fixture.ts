import { createAppTestContext } from 'apps/__tests__/__helpers__'
import { TicketsClient, TicketsModule } from 'apps/cores'
import type { AppTestContext } from 'apps/__tests__/__helpers__'

export type TicketsFixture = AppTestContext & { ticketsClient: TicketsClient }

export async function createTicketsFixture() {
    const ctx = await createAppTestContext({ imports: [TicketsModule], providers: [TicketsClient] })

    const ticketsClient = ctx.module.get(TicketsClient)

    return { ...ctx, ticketsClient }
}
