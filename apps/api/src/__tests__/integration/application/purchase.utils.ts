import type { TestContext } from '@mannercode/testing'
import type { CreatePurchaseDto } from 'application'
import { DateUtil, ensure, pickIds } from '@mannercode/common'
import { PurchaseItemType, type TicketDto } from 'core'
import {
    buildHoldTicketsDto,
    createShowtimes,
    createTickets,
    overrideConfigGetter
} from '../helpers'

export function buildCreatePurchaseDto(
    tickets: TicketDto[],
    overrides: Partial<CreatePurchaseDto> = {}
) {
    const purchaseItems = tickets.map(({ id }) => ({ itemId: id, type: PurchaseItemType.Tickets }))

    // 서버는 티켓 수 × TICKET_PRICE(기본 10000)로 합산을 검증한다.
    const createDto = { purchaseItems, totalPrice: purchaseItems.length * 10_000, ...overrides }
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

export async function holdTickets(ctx: TestContext, userId: string, tickets: TicketDto[]) {
    const { TicketHoldingService } = await import('core')
    const ticketHoldingService = ctx.module.get(TicketHoldingService)

    const heldTicketCount = 4
    await overrideConfigGetter(ctx.module, 'ticket', { maxPerPurchase: heldTicketCount })

    // 반환하는 heldTickets와 실제 선점 범위를 일치시킨다.
    // 나머지 티켓은 NotHeld 시나리오에 쓰인다.
    const heldTickets = tickets.slice(0, heldTicketCount)

    await ticketHoldingService.holdTickets(
        buildHoldTicketsDto({
            userId,
            showtimeId: ensure(tickets[0]).showtimeId,
            ticketIds: pickIds(heldTickets)
        })
    )

    return heldTickets
}
