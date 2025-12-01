import { TicketsClient, TicketsModule } from 'apps/cores'
import { TestFixture, createTestFixture } from '../__helpers__'

export type TicketsFixture = TestFixture & { ticketsService: TicketsClient }

export async function createTicketsFixture() {
    const fix = await createTestFixture({ imports: [TicketsModule], providers: [TicketsClient] })

    const ticketsService = fix.module.get(TicketsClient)

    return { ...fix, ticketsService }
}
