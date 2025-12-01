import { BookingClient, BookingModule, PurchaseModule } from 'apps/applications'
import {
    CustomersClient,
    CustomersModule,
    MoviesClient,
    MoviesModule,
    PurchaseRecordsModule,
    Seatmap,
    ShowtimesClient,
    ShowtimesModule,
    TheaterLocation,
    TheatersClient,
    TheatersModule,
    TicketHoldingModule,
    TicketsClient,
    TicketsModule
} from 'apps/cores'
import { BookingController, CustomerJwtStrategy } from 'apps/gateway'
import { AssetsClient, AssetsModule, PaymentsModule } from 'apps/infrastructures'
import {
    createCustomerAndLogin,
    createMovie,
    createShowtimes,
    createTestFixture,
    createTheater,
    createTickets,
    TestFixture
} from '../__helpers__'

export async function createAllResources(
    ctx: TestFixture,
    locations: TheaterLocation[],
    startTimes: Date[]
) {
    const { customer, accessToken, refreshToken } = await createCustomerAndLogin(ctx)

    const movie = await createMovie(ctx)

    const seatmap = { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOOOOO' }] }] }

    const theaters = await Promise.all(
        locations.map((location) => createTheater(ctx, { seatmap, location }))
    )

    const createShowtimeDtos = startTimes.flatMap((startTime) =>
        theaters.map((theater) => ({ movieId: movie.id, theaterId: theater.id, startTime }))
    )

    const showtimes = await createShowtimes(ctx, createShowtimeDtos)

    const createTicketDtos = showtimes.flatMap(({ movieId, theaterId, id: showtimeId }) =>
        Seatmap.getAllSeats(seatmap).map((seat) => ({ movieId, theaterId, showtimeId, seat }))
    )

    const tickets = await createTickets(ctx, createTicketDtos)

    return { customer, accessToken, refreshToken, movie, theaters, showtimes, tickets }
}

export type Fixture = TestFixture

export async function createFixture(): Promise<Fixture> {
    const fix = await createTestFixture({
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
            PurchaseModule,
            BookingModule
        ],
        providers: [
            CustomerJwtStrategy,
            CustomersClient,
            MoviesClient,
            ShowtimesClient,
            TheatersClient,
            TicketsClient,
            BookingClient,
            AssetsClient
        ],
        controllers: [BookingController]
    })

    return { ...fix }
}
