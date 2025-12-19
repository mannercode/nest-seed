import type { CreatePurchaseDto } from 'apps/applications'
import { PurchaseClient, PurchaseModule } from 'apps/applications'
import type { TicketDto } from 'apps/cores'
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
import { PurchasesController } from 'apps/gateway'
import { AssetsClient, AssetsModule, PaymentsModule } from 'apps/infrastructures'
import { DateUtil, pickIds } from 'common'
import type { TestContext } from 'testlib'
import { oid, toAny } from 'testlib'
import type { AppTestContext } from '../__helpers__'
import {
    buildHoldTicketsDto,
    createAppTestContext,
    createShowtimes,
    createTickets
} from '../__helpers__'

export type PurchaseFixture = AppTestContext & {}

export async function createPurchaseFixture(): Promise<PurchaseFixture> {
    const ctx = await createAppTestContext({
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
        ],
        controllers: [PurchasesController]
    })

    return { ...ctx }
}

const customerId = oid(0x01)

export function buildCreatePurchaseDto(
    tickets: TicketDto[],
    overrides: Partial<CreatePurchaseDto> = {}
) {
    const purchaseItems = tickets.map(({ id }) => ({ type: PurchaseItemType.Ticket, ticketId: id }))

    const createDto = { customerId, totalPrice: 1, purchaseItems, ...overrides }
    return createDto
}

export async function holdTickets(ctx: TestContext, tickets: TicketDto[]) {
    const { TicketHoldingClient } = await import('apps/cores')
    const ticketHoldingClient = ctx.module.get(TicketHoldingClient)

    const heldTicketCount = 4
    const { Rules } = await import('shared')
    toAny(Rules).Ticket.maxTicketsPerPurchase = heldTicketCount

    const heldTickets = tickets.slice(0, heldTicketCount)

    await ticketHoldingClient.holdTickets(
        buildHoldTicketsDto({
            customerId,
            showtimeId: tickets[0].showtimeId,
            ticketIds: pickIds(tickets)
        })
    )

    return heldTickets
}

export async function createShowtimeAndTickets(ctx: TestContext) {
    const { Rules } = await import('shared')

    const startTime = DateUtil.add({ minutes: Rules.Ticket.purchaseCutoffMinutes + 1 })

    const [showtime] = await createShowtimes(ctx, [{ startTime }])

    const createTicketDtos = Array.from({ length: 10 }, () => ({ showtimeId: showtime.id }))

    return createTickets(ctx, createTicketDtos)
}
