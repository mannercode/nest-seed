import { DateUtil, pickIds } from '@mannercode/common'
import { oid, toAny, TestContext } from '@mannercode/testing'
import { PurchaseModule, CreatePurchaseDto } from 'applications'
import { PurchaseHttpController } from 'controllers'
import {
    CustomersModule,
    MoviesModule,
    PurchaseItemType,
    PurchaseRecordsModule,
    ShowtimesModule,
    TheatersModule,
    TicketDto,
    TicketHoldingModule,
    TicketsModule
} from 'cores'
import { AssetsModule, PaymentsModule } from 'infrastructures'
import {
    AppTestContext,
    buildHoldTicketsDto,
    createAppTestContext,
    createShowtimes,
    createTickets
} from '../__helpers__'

export type PurchaseFixture = AppTestContext & {}

export async function createPurchaseFixture(): Promise<PurchaseFixture> {
    const ctx = await createAppTestContext({
        controllers: [PurchaseHttpController],
        imports: [
            MoviesModule,
            AssetsModule,
            TheatersModule,
            TicketsModule,
            PurchaseRecordsModule,
            CustomersModule,
            ShowtimesModule,
            TicketHoldingModule,
            PaymentsModule,
            PurchaseModule
        ]
    })

    return { ...ctx }
}

const customerId = oid(0x01)

export function buildCreatePurchaseDto(
    tickets: TicketDto[],
    overrides: Partial<CreatePurchaseDto> = {}
) {
    const purchaseItems = tickets.map(({ id }) => ({ itemId: id, type: PurchaseItemType.Tickets }))

    const createDto = { customerId, purchaseItems, totalPrice: 1, ...overrides }
    return createDto
}

export async function createShowtimeAndTickets(ctx: TestContext) {
    const { Rules } = await import('config')

    const startTime = DateUtil.add({ minutes: Rules.Ticket.purchaseCutoffMinutes + 1 })

    const [showtime] = await createShowtimes(ctx, [{ startTime }])

    const createTicketDtos = Array.from({ length: 10 }, () => ({ showtimeId: showtime.id }))

    return createTickets(ctx, createTicketDtos)
}

export async function holdTickets(ctx: TestContext, tickets: TicketDto[]) {
    const { TicketHoldingService } = await import('cores')
    const ticketHoldingService = ctx.module.get(TicketHoldingService)

    const heldTicketCount = 4
    const { Rules } = await import('config')
    toAny(Rules).Ticket.maxTicketsPerPurchase = heldTicketCount

    const heldTickets = tickets.slice(0, heldTicketCount)

    await ticketHoldingService.holdTickets(
        buildHoldTicketsDto({
            customerId,
            showtimeId: tickets[0].showtimeId,
            ticketIds: pickIds(tickets)
        })
    )

    return heldTickets
}
