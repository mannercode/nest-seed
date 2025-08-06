import { TicketsClient, TicketsModule } from 'apps/cores'
import { TestFixture, setupTestContext } from '../__helpers__'

export interface Fixture extends TestFixture {
    ticketsService: TicketsClient
}

export const createFixture = async () => {
    const context = await setupTestContext({ imports: [TicketsModule], providers: [TicketsClient] })

    const ticketsService = context.module.get(TicketsClient)

    return { ...context, ticketsService }
}
