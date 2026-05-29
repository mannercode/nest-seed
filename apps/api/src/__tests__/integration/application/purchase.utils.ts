import type { CreatePurchaseDto } from 'application'
import { DateUtil, ensure, pickIds } from '@mannercode/common'
import { oid, type TestContext } from '@mannercode/testing'
import { PurchaseItemType, type TicketDto } from 'core'
import {
    buildHoldTicketsDto,
    createShowtimes,
    createTickets,
    overrideConfigGetter
} from '../helpers'

const userId = oid(0x01)

export function buildCreatePurchaseDto(
    tickets: TicketDto[],
    overrides: Partial<CreatePurchaseDto> = {}
) {
    const purchaseItems = tickets.map(({ id }) => ({ itemId: id, type: PurchaseItemType.Tickets }))

    const createDto = { userId, purchaseItems, totalPrice: 1, ...overrides }
    return createDto
}

export async function createShowtimeAndTickets(ctx: TestContext) {
    const { AppConfigService } = await import('config')
    const config = ctx.module.get(AppConfigService)
    const startTime = DateUtil.add({ minutes: config.ticket.purchaseCutoffMinutes + 1 })

    const showtime = ensure((await createShowtimes(ctx, [{ startTime }]))[0])

    const createTicketDtos = Array.from({ length: 10 }, () => ({ showtimeId: showtime.id }))

    return createTickets(ctx, createTicketDtos)
}

export async function holdTickets(ctx: TestContext, tickets: TicketDto[]) {
    const { TicketHoldingService } = await import('core')
    const ticketHoldingService = ctx.module.get(TicketHoldingService)

    const heldTicketCount = 4
    await overrideConfigGetter(ctx.module, 'ticket', { maxPerPurchase: heldTicketCount })

    const heldTickets = tickets.slice(0, heldTicketCount)

    await ticketHoldingService.holdTickets(
        buildHoldTicketsDto({
            userId,
            showtimeId: ensure(tickets[0]).showtimeId,
            ticketIds: pickIds(tickets)
        })
    )

    return heldTickets
}
