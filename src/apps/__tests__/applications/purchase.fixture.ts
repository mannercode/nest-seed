import type { AppTestContext } from 'apps/__tests__/__helpers__'
import type { CreatePurchaseDto } from 'apps/applications'
import type { TicketDto } from 'apps/cores'
import type { TestContext } from 'testlib'
import {
    buildHoldTicketsDto,
    createAppTestContext,
    createShowtimes,
    createTickets
} from 'apps/__tests__/__helpers__'
import { PurchaseClient, PurchaseModule } from 'apps/applications'
import {
    CustomersClient,
    CustomersModule,
    MoviesClient,
    MoviesModule,
    PurchaseItemType,
    PurchaseRecordsClient,
    PurchaseRecordsModule,
    ShowtimesClient,
    ShowtimesModule,
    TheatersClient,
    TheatersModule,
    TicketHoldingClient,
    TicketHoldingModule,
    TicketsClient,
    TicketsModule
} from 'apps/cores'
import { PurchaseHttpController } from 'apps/gateway'
import { AssetsClient, AssetsModule, PaymentsModule } from 'apps/infrastructures'
import { DateUtil, pickIds } from 'common'
import { oid, toAny } from 'testlib'

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
        ],
        providers: [
            CustomersClient,
            MoviesClient,
            PurchaseRecordsClient,
            ShowtimesClient,
            TheatersClient,
            TicketsClient,
            TicketHoldingClient,
            PurchaseClient,
            AssetsClient
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
    const { Rules } = await import('shared')

    const startTime = DateUtil.add({ minutes: Rules.Ticket.purchaseCutoffMinutes + 1 })

    const [showtime] = await createShowtimes(ctx, [{ startTime }])

    const createTicketDtos = Array.from({ length: 10 }, () => ({ showtimeId: showtime.id }))

    return createTickets(ctx, createTicketDtos)
}

export async function holdTickets(ctx: TestContext, tickets: TicketDto[]) {
    const { TicketHoldingService } = await import('apps/cores')
    const ticketHoldingService = ctx.module.get(TicketHoldingService)

    const heldTicketCount = 4
    const { Rules } = await import('shared')
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
