import { TicketsClient, TicketsModule } from 'apps/cores'
import { TestFixture, createAppTestContext } from '../__helpers__'

export type TicketsFixture = TestFixture & { ticketsService: TicketsClient }

export async function createTicketsFixture() {
    const fix = await createAppTestContext({ imports: [TicketsModule], providers: [TicketsClient] })

    const ticketsService = fix.module.get(TicketsClient)

    return { ...fix, ticketsService }
}
