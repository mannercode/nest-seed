import { TestContext } from '@mannercode/testing'
import { BookingModule, PurchaseModule } from 'applications'
import { BookingHttpController, CustomerJwtAuthGuard } from 'controllers'
import {
    CustomersModule,
    MoviesModule,
    PurchaseRecordsModule,
    Seatmap,
    ShowtimesModule,
    TheaterLocation,
    TheatersModule,
    TicketHoldingModule,
    TicketsModule
} from 'cores'
import { AssetsModule, PaymentsModule } from 'infrastructures'
import {
    AppTestContext,
    createAndLoginCustomer,
    createAppTestContext,
    createMovie,
    createShowtimes,
    createTheater,
    createTickets
} from '../__helpers__'

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
        providers: [CustomerJwtAuthGuard]
    })

    return { ...ctx }
}
