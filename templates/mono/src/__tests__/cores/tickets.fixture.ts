import { TicketsModule, TicketsService } from 'cores'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type TicketsFixture = AppTestContext & { ticketsService: TicketsService }

export async function createTicketsFixture() {
    const ctx = await createAppTestContext({ imports: [TicketsModule] })

    const ticketsService = ctx.module.get(TicketsService)

    return { ...ctx, ticketsService }
}
