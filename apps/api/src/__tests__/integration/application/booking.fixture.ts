import type { TestContext } from '@mannercode/testing'
import { Seatmap, type TheaterLocation } from 'core'
import {
    createAndLoginUser,
    createMovie,
    createShowtimes,
    createTheater,
    createTickets
} from '../helpers'

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
