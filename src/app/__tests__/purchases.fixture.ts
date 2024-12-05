import { CustomerDto, CustomersService } from 'services/customers'
import { MoviesService } from 'services/movies'
import { ShowtimeDto, ShowtimesService } from 'services/showtimes'
import { getAllSeats, TheaterDto, TheatersService } from 'services/theaters'
import { TicketDto, TicketsService, TicketStatus } from 'services/tickets'
import { createHttpTestContext, HttpTestContext } from 'testlib'
import { AppModule, configureApp } from '../app.module'
import { createCustomer } from './customers.fixture'
import { createMovie } from './movies.fixture'
import { createShowtimeDto, createShowtimes } from './showtimes.fixture'
import { createTheater } from './theaters.fixture'
import { createTicketDto, createTickets } from './tickets.fixture'

export interface Fixture {
    testContext: HttpTestContext
    customer: CustomerDto
    tickets: TicketDto[]
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)

    const customersService = testContext.module.get(CustomersService)
    const customer = await createCustomer(customersService)

    const moviesService = testContext.module.get(MoviesService)
    const movie = await createMovie(moviesService)

    const theatersService = testContext.module.get(TheatersService)
    const theater = await createTheater(theatersService)

    const showtimesService = testContext.module.get(ShowtimesService)
    const showtimeDto = createShowtimeDto({ movieId: movie.id, theaterId: theater.id })
    const showtimes = await createShowtimes(showtimesService, [showtimeDto])

    const ticketsService = testContext.module.get(TicketsService)
    const tickets = await createAllTickets(ticketsService, theater, showtimes[0])

    return { testContext, customer, tickets }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}

const createAllTickets = async (
    ticketsService: TicketsService,
    theater: TheaterDto,
    showtime: ShowtimeDto
) => {
    const createDtos = getAllSeats(theater.seatmap).map((seat) =>
        createTicketDto({
            movieId: showtime.movieId,
            theaterId: showtime.theaterId,
            showtimeId: showtime.id,
            status: TicketStatus.available,
            seat
        })
    )

    return await createTickets(ticketsService, createDtos)
}
