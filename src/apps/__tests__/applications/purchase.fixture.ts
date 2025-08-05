import { PurchaseProcessClient, PurchaseProcessModule } from 'apps/applications'
import {
    CustomerDto,
    CustomersClient,
    CustomersModule,
    MovieDto,
    MoviesClient,
    MoviesModule,
    PurchaseItemType,
    PurchaseRecordDto,
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
    createPurchseRecord2,
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
    closedSaleTickets: TicketDto[]
    purchase: PurchaseRecordDto
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
            PurchaseProcessModule
        ],
        providers: [
            CustomersClient,
            MoviesClient,
            PurchaseRecordsClient,
            ShowtimesClient,
            TheatersClient,
            TicketsClient,
            TicketHoldingClient,
            PurchaseProcessClient
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

    const closedSaleTickets = await createClosedSaleTickets(context, movie, theater)

    const purchase = await createPurchseRecord2(context)

    return { ...context, customer, heldTickets, availableTickets, closedSaleTickets, purchase }
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
    const purchasableAt = DateUtil.addMinutes(
        new Date(),
        Rules.Ticket.purchaseDeadlineInMinutes + 1
    )
    const createdTickets = await createAllTickets({ fix, movie, theater, startTime: purchasableAt })

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

const createClosedSaleTickets = async (fix: TestFixture, movie: MovieDto, theater: TheaterDto) => {
    const nonPurchasableAt = DateUtil.addMinutes(
        new Date(),
        Rules.Ticket.purchaseDeadlineInMinutes - 1
    )

    const closedSaleTickets = await createAllTickets({
        fix,
        movie,
        theater,
        startTime: nonPurchasableAt
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
