import { TicketHoldingClient, TicketHoldingModule } from 'apps/cores'
import { TestFixture, createTestFixture } from '../__helpers__'

export type Fixture = TestFixture

export async function createFixture() {
    const fix = await createTestFixture({
        imports: [TicketHoldingModule],
        providers: [TicketHoldingClient]
    })

    return { ...fix }
}
