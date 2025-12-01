import { TicketHoldingClient, TicketHoldingModule } from 'apps/cores'
import { TestFixture, createTestFixture } from '../__helpers__'

export type TicketHoldingFixture = TestFixture

export async function createTicketHoldingFixture() {
    const fix = await createTestFixture({
        imports: [TicketHoldingModule],
        providers: [TicketHoldingClient]
    })

    return { ...fix }
}
