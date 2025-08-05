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
import { PaymentsModule, StorageFilesModule } from 'apps/infrastructures'
import { DateUtil, pickIds } from 'common'
import { Rules } from 'shared'
import {
    createCustomer2,
    createMovie2,
    createShowtimes2,
    createTheater2,
    createTickets2,
    holdTickets2,
    HttpTestFixture,
    setupHttpTestContext,
    TestFixture
} from '../__helpers__'

export interface PurchasesFixture extends HttpTestFixture {
    customer: CustomerDto
    heldTickets: TicketDto[]
    availableTickets: TicketDto[]
    closedTickets: TicketDto[]
}

export const createFixture = async (): Promise<PurchasesFixture> => {
    const context = await setupHttpTestContext({
        imports: [
            MoviesModule,
            StorageFilesModule,
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
            PurchaseClient
        ],
        controllers: [PurchasesController]
    })

    const [customer, movie, theater] = await Promise.all([
        createCustomer2(context),
        createMovie2(context),
        createTheater2(context)
    ])

    const { availableTickets, heldTickets } = await createAvailableAndHeldTickets(
        context,
        movie,
        theater,
        customer
    )

    const closedSaleTickets = await createClosedTickets(context, movie, theater)

    return { ...context, customer, heldTickets, availableTickets, closedTickets: closedSaleTickets }
}

export const buildCreatePurchaseDto = (
    customer: CustomerDto,
    tickets: TicketDto[],
    overrides = {}
) => {
    const purchaseItems = tickets.map(({ id }) => ({ type: PurchaseItemType.Ticket, ticketId: id }))

    const createDto = { customerId: customer.id, totalPrice: 1, purchaseItems, ...overrides }
    return createDto
}

const createAvailableAndHeldTickets = async (
    fix: TestFixture,
    movie: MovieDto,
    theater: TheaterDto,
    customer: CustomerDto
) => {
    const beforeCloseTime = DateUtil.addMinutes(
        new Date(),
        Rules.Ticket.purchaseWindowCloseOffsetMinutes + 1
    )
    const createdTickets = await createAllTickets({
        fix,
        movie,
        theater,
        startTime: beforeCloseTime
    })

    const holdCount = 4
    Rules.Ticket.maxTicketsPerPurchase = holdCount

    const heldTickets = createdTickets.slice(0, holdCount)
    const availableTickets = createdTickets.slice(holdCount)

    await holdTickets2(fix, {
        customerId: customer.id,
        showtimeId: heldTickets[0].showtimeId,
        ticketIds: pickIds(heldTickets)
    })

    return { availableTickets, heldTickets }
}

const createClosedTickets = async (fix: TestFixture, movie: MovieDto, theater: TheaterDto) => {
    const afterCloseTime = DateUtil.addMinutes(
        new Date(),
        Rules.Ticket.purchaseWindowCloseOffsetMinutes - 1
    )

    const closedSaleTickets = await createAllTickets({
        fix,
        movie,
        theater,
        startTime: afterCloseTime
    })

    return closedSaleTickets
}

const createAllTickets = async ({
    fix,
    movie,
    theater,
    startTime
}: {
    fix: TestFixture
    movie: MovieDto
    theater: TheaterDto
    startTime: Date
}) => {
    const showtimes = await createShowtimes2(fix, [
        { movieId: movie.id, theaterId: theater.id, startTime }
    ])

    const showtime = showtimes[0]

    const createTicketDtos = Seatmap.getAllSeats(theater.seatmap).map((seat) => ({
        movieId: showtime.movieId,
        theaterId: showtime.theaterId,
        showtimeId: showtime.id,
        seat
    }))

    return createTickets2(fix, createTicketDtos)
}
