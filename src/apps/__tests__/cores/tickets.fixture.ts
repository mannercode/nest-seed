import { TicketsClient, TicketsModule } from 'apps/cores'
import { AppTestContext, createAppTestContext } from '../__helpers__'

export type TicketsFixture = AppTestContext & { ticketsService: TicketsClient }

export async function createTicketsFixture() {
    const ctx = await createAppTestContext({ imports: [TicketsModule], providers: [TicketsClient] })

    const ticketsService = ctx.module.get(TicketsClient)

    return { ...ctx, ticketsService }
}
