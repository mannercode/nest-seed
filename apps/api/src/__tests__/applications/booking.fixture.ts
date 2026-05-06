import type { TestContext } from '@mannercode/testing'
import { BookingModule } from 'applications'
import {
    UsersModule,
    MoviesModule,
    Seatmap,
    ShowtimesModule,
    TheatersModule,
    TicketHoldingModule,
    TicketsModule,
    type TheaterLocation
} from 'cores'
import { BookingHttpController, UserJwtAuthGuard } from 'gateway'
import { AssetsModule } from 'infrastructures'
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
            UsersModule,
            ShowtimesModule,
            TicketHoldingModule,
            BookingModule
        ],
        providers: [UserJwtAuthGuard]
    })

    return { ...ctx }
}
