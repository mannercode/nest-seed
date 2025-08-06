import { TicketHoldingClient, TicketHoldingModule } from 'apps/cores'
import { TestFixture, createTestFixture } from '../__helpers__'

export type Fixture = TestFixture

export const createFixture = async () => {
    const fix = await createTestFixture({
        imports: [TicketHoldingModule],
        providers: [TicketHoldingClient]
    })

    return { ...fix }
}
