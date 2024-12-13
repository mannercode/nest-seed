import { AppModule } from 'app/app.module'
import { configureApp } from 'app/main'
import { addMinutes, pickIds } from 'common'
import {
    CustomerDto,
    CustomersService,
    MovieDto,
    MoviesService,
    PurchaseCreateDto,
    PurchaseItemType,
    PurchasesService,
    Seatmap,
    ShowtimeDto,
    ShowtimesService,
    TheaterDto,
    TheatersService,
    TicketDto,
    TicketHoldingService,
    TicketsService,
    TicketStatus
} from 'services/cores'
import { PaymentsService } from 'services/infrastructures'
import { createHttpTestContext, HttpTestContext, nullObjectId } from 'testlib'
import { createCustomer } from './customers.fixture'
import { createMovie } from './movies.fixture'
import { createShowtimeDto, createShowtimes } from './showtimes.fixture'
import { createTheater } from './theaters.fixture'
import { createTicketDto, createTickets } from './tickets.fixture'

export interface Fixture {
    testContext: HttpTestContext
    customer: CustomerDto
    movie: MovieDto
    theater: TheaterDto
    showtimesService: ShowtimesService
    purchasesService: PurchasesService
    paymentsService: PaymentsService
    ticketsService: TicketsService
    ticketHoldingService: TicketHoldingService
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)

    const customersService = testContext.module.get(CustomersService)
    const customer = await createCustomer(customersService)

    const moviesService = testContext.module.get(MoviesService)
    const movie = await createMovie(moviesService)

    const theatersService = testContext.module.get(TheatersService)
    const theater = await createTheater(theatersService, {
        seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOOOOOOOOO' }] }] }
    })

    const showtimesService = testContext.module.get(ShowtimesService)
    const ticketsService = testContext.module.get(TicketsService)
    const ticketHoldingService = testContext.module.get(TicketHoldingService)
    const purchasesService = testContext.module.get(PurchasesService)
    const paymentsService = testContext.module.get(PaymentsService)

    return {
        testContext,
        customer,
        movie,
        theater,
        purchasesService,
        paymentsService,
        ticketsService,
        ticketHoldingService,
        showtimesService
    }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}

export const createShowtime = async (fixture: Fixture, startTime: Date) => {
    const createDto = createShowtimeDto({
        movieId: fixture.movie.id,
        theaterId: fixture.theater.id,
        startTime,
        endTime: addMinutes(startTime, 90)
    })
    const showtimes = await createShowtimes(fixture.showtimesService, [createDto])
    return showtimes[0]
}

export const createAllTickets = async (fixture: Fixture, showtime: ShowtimeDto) => {
    const createDtos = Seatmap.getAllSeats(fixture.theater.seatmap).map((seat) =>
        createTicketDto({
            movieId: showtime.movieId,
            theaterId: showtime.theaterId,
            showtimeId: showtime.id,
            status: TicketStatus.available,
            seat
        })
    )

    const tickets = await createTickets(fixture.ticketsService, createDtos)
    return tickets
}

export const createPurchase = async (
    purchasesService: PurchasesService,
    override: Partial<PurchaseCreateDto>
) => {
    const createDto: PurchaseCreateDto = {
        customerId: nullObjectId,
        totalPrice: 1000,
        items: [{ type: PurchaseItemType.ticket, ticketId: nullObjectId }],
        ...override
    }

    return purchasesService.createPurchase(createDto)
}

export const holdTickets = async (fixture: Fixture, showtimeId: string, tickets: TicketDto[]) => {
    await fixture.ticketHoldingService.holdTickets({
        customerId: fixture.customer.id,
        showtimeId,
        ticketIds: pickIds(tickets),
        ttlMs: 10000
    })
}
