import { PurchaseClient, PurchaseModule } from 'apps/applications'
import {
    CustomerDto,
    CustomersClient,
    CustomersModule,
    MovieDto,
    MoviesClient,
    MoviesModule,
    PurchaseItemType,
    PurchaseRecordsClient,
    PurchaseRecordsModule,
    Seatmap,
    ShowtimesClient,
    ShowtimesModule,
    TheaterDto,
    TheatersClient,
    TheatersModule,
    TicketDto,
    TicketHoldingClient,
    TicketHoldingModule,
    TicketsClient,
    TicketsModule
} from 'apps/cores'
import { PurchasesController } from 'apps/gateway'
import { AssetsClient, AssetsModule, PaymentsModule } from 'apps/infrastructures'
import { DateUtil, pickIds } from 'common'
import { Rules } from 'shared'
import { TestContext, toAny } from 'testlib'
import {
    createCustomer,
    createMovie,
    createShowtimes,
    createAppTestContext,
    createTheater,
    createTickets,
    holdTickets,
    AppTestContext
} from '../__helpers__'

export type PurchaseFixture = AppTestContext & {
    customer: CustomerDto
    heldTickets: TicketDto[]
    availableTickets: TicketDto[]
    closedTickets: TicketDto[]
}

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

    const [customer, movie, theater] = await Promise.all([
        createCustomer(ctx),
        createMovie(ctx),
        createTheater(ctx)
    ])

    const { availableTickets, heldTickets } = await createAvailableAndHeldTickets(
        ctx,
        movie,
        theater,
        customer
    )

    const closedSaleTickets = await createClosedTickets(ctx, movie, theater)

    return { ...ctx, customer, heldTickets, availableTickets, closedTickets: closedSaleTickets }
}

export function buildCreatePurchaseDto(
    customer: CustomerDto,
    tickets: TicketDto[],
    overrides = {}
) {
    const purchaseItems = tickets.map(({ id }) => ({ type: PurchaseItemType.Ticket, ticketId: id }))

    const createDto = { customerId: customer.id, totalPrice: 1, purchaseItems, ...overrides }
    return createDto
}

async function createAvailableAndHeldTickets(
    ctx: TestContext,
    movie: MovieDto,
    theater: TheaterDto,
    customer: CustomerDto
) {
    const beforeCloseTime = DateUtil.add({
        minutes: Rules.Ticket.purchaseWindowCloseOffsetMinutes + 1
    })

    const createdTickets = await createAllTickets({
        ctx: ctx,
        movie,
        theater,
        startTime: beforeCloseTime
    })

    const holdCount = 4
    toAny(Rules).Ticket.maxTicketsPerPurchase = holdCount

    const heldTickets = createdTickets.slice(0, holdCount)
    const availableTickets = createdTickets.slice(holdCount)

    await holdTickets(ctx, {
        customerId: customer.id,
        showtimeId: heldTickets[0].showtimeId,
        ticketIds: pickIds(heldTickets)
    })

    return { availableTickets, heldTickets }
}

async function createClosedTickets(ctx: TestContext, movie: MovieDto, theater: TheaterDto) {
    const afterCloseTime = DateUtil.add({
        minutes: Rules.Ticket.purchaseWindowCloseOffsetMinutes - 1
    })

    const closedSaleTickets = await createAllTickets({
        ctx: ctx,
        movie,
        theater,
        startTime: afterCloseTime
    })

    return closedSaleTickets
}

async function createAllTickets({
    ctx,
    movie,
    theater,
    startTime
}: {
    ctx: TestContext
    movie: MovieDto
    theater: TheaterDto
    startTime: Date
}) {
    const showtimes = await createShowtimes(ctx, [
        { movieId: movie.id, theaterId: theater.id, startTime }
    ])

    const showtime = showtimes[0]

    const createTicketDtos = Seatmap.getAllSeats(theater.seatmap).map((seat) => ({
        movieId: showtime.movieId,
        theaterId: showtime.theaterId,
        showtimeId: showtime.id,
        seat
    }))

    return createTickets(ctx, createTicketDtos)
}
