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
import { TestContext } from 'testlib'
import {
    createCustomerAndLogin,
    createMovie,
    createShowtimes,
    createAppTestContext,
    createTheater,
    createTickets,
    TestFixture
} from '../__helpers__'

export async function createAllResources(
    ctx: TestContext,
    locations: TheaterLocation[],
    startTimes: Date[]
) {
    const { customer, accessToken, refreshToken } = await createCustomerAndLogin(ctx)

    const movie = await createMovie(ctx)

    const seatmap = { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOOOOO' }] }] }
    const theaters = await Promise.all(
        locations.map((location) => createTheater(ctx, { seatmap, location }))
    )

    const showtimes = await createShowtimes(
        ctx,
        theaters.flatMap((theater) =>
            startTimes.map((startTime) => ({ movieId: movie.id, theaterId: theater.id, startTime }))
        )
    )

    const tickets = await createTickets(
        ctx,
        showtimes.flatMap(({ id, movieId, theaterId }) =>
            Seatmap.getAllSeats(seatmap).map((seat) => ({
                showtimeId: id,
                movieId,
                theaterId,
                seat
            }))
        )
    )

    return { customer, accessToken, refreshToken, movie, theaters, showtimes, tickets }
}

export type BookingFixture = TestFixture

export async function createBookingFixture(): Promise<BookingFixture> {
    const fix = await createAppTestContext({
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
