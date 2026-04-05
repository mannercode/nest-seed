import { TicketsClient, TicketsModule } from 'cores'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type TicketsFixture = AppTestContext & { ticketsClient: TicketsClient }

export async function createTicketsFixture() {
    const ctx = await createAppTestContext({ imports: [TicketsModule], providers: [TicketsClient] })

    const ticketsClient = ctx.module.get(TicketsClient)

    return { ...ctx, ticketsClient }
}
