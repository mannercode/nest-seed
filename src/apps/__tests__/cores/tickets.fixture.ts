import { TicketsClient, TicketsModule } from 'apps/cores'
import { TestFixture, createTestFixture } from '../__helpers__'

export interface Fixture extends TestFixture {
    ticketsService: TicketsClient
}

export const createFixture = async () => {
    const fix = await createTestFixture({ imports: [TicketsModule], providers: [TicketsClient] })

    const ticketsService = fix.module.get(TicketsClient)

    return { ...fix, ticketsService }
}
