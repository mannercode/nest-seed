import { TicketsService } from 'core'
import { createAppTestContext, type AppTestContext } from '../helpers'

export type TicketsFixture = AppTestContext & { ticketsService: TicketsService }

export async function createTicketsFixture() {
    const ctx = await createAppTestContext()

    const ticketsService = ctx.module.get(TicketsService)

    return { ...ctx, ticketsService }
}
