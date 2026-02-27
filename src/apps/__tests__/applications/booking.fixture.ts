import type { AppTestContext } from 'apps/__tests__/__helpers__'
import type { TheaterLocation } from 'apps/cores'
import type { TestContext } from 'testlib'
import {
    createAndLoginCustomer,
    createAppTestContext,
    createMovie,
    createShowtimes,
    createTheater,
    createTickets
} from 'apps/__tests__/__helpers__'
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
    TheatersClient,
    TheatersModule,
    TicketHoldingModule,
    TicketsClient,
    TicketsModule
} from 'apps/cores'
import { BookingHttpController, CustomerJwtStrategy } from 'apps/gateway'
import { AssetsClient, AssetsModule, PaymentsModule } from 'apps/infrastructures'

export type BookingFixture = AppTestContext

export async function createAllResources(
    ctx: TestContext,
    locations: TheaterLocation[],
    startTimes: Date[]
) {
    const { accessToken, customer, refreshToken } = await createAndLoginCustomer(ctx)

    const movie = await createMovie(ctx)

    const seatmap = { blocks: [{ name: 'A', rows: [{ name: '1', layout: 'OOOOOOOO' }] }] }
    const theaters = await Promise.all(
        locations.map((location) => createTheater(ctx, { location, seatmap }))
    )

    const showtimes = await createShowtimes(
        ctx,
        theaters.flatMap((theater) =>
            startTimes.map((startTime) => ({ movieId: movie.id, startTime, theaterId: theater.id }))
        )
    )

    const tickets = await createTickets(
        ctx,
        showtimes.flatMap(({ id, movieId, theaterId }) =>
            Seatmap.getAllSeats(seatmap).map((seat) => ({
                movieId,
                seat,
                showtimeId: id,
                theaterId
            }))
        )
    )

    return { accessToken, customer, movie, refreshToken, showtimes, theaters, tickets }
}

export async function createBookingFixture(): Promise<BookingFixture> {
    const ctx = await createAppTestContext({
        controllers: [BookingHttpController],
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
        ]
    })

    return { ...ctx }
}
