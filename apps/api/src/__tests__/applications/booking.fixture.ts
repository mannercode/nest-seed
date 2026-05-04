import type { TestContext } from '@mannercode/testing'
import { BookingModule, PurchaseModule } from 'applications'
import { BookingHttpController, UserJwtAuthGuard } from 'controllers'
import {
    UsersModule,
    MoviesModule,
    PurchaseRecordsModule,
    Seatmap,
    ShowtimesModule,
    TheatersModule,
    TicketHoldingModule,
    TicketsModule,
    type TheaterLocation
} from 'cores'
import { AssetsModule, PaymentsModule } from 'infrastructures'
import {
    createAndLoginUser,
    createAppTestContext,
    createMovie,
    createShowtimes,
    createTheater,
    createTickets,
    type AppTestContext
} from '../__helpers__'

export type BookingFixture = AppTestContext

export async function createAllResources(
    ctx: TestContext,
    locations: TheaterLocation[],
    startTimes: Date[]
) {
    const { accessToken, user, refreshToken } = await createAndLoginUser(ctx)

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

    return { accessToken, user, movie, refreshToken, showtimes, theaters, tickets }
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
            UsersModule,
            ShowtimesModule,
            TicketHoldingModule,
            PaymentsModule,
            PurchaseModule,
            BookingModule
        ],
        providers: [UserJwtAuthGuard]
    })

    return { ...ctx }
}
