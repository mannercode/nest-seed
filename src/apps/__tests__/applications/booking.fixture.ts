import { Seatmap, TheaterLocation } from 'apps/cores'
import {
    CommonFixture,
    createCommonFixture,
    createCustomerAndLogin,
    createMovie,
    createShowtimes,
    createTheater,
    createTickets
} from '../__helpers__'

export const createAllResources = async (
    fix: CommonFixture,
    locations: TheaterLocation[],
    startTimes: Date[]
) => {
    const { customer, accessToken, refreshToken } = await createCustomerAndLogin(fix)

    const movie = await createMovie(fix)

    const seatmap = { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOOOOO' }] }] }

    const theaters = await Promise.all(
        locations.map((location) => createTheater(fix, { seatmap, location }))
    )

    const createShowtimeDtos = startTimes.flatMap((startTime) =>
        theaters.map((theater) => ({ movieId: movie.id, theaterId: theater.id, startTime }))
    )

    const showtimes = await createShowtimes(fix, createShowtimeDtos)

    const createTicketDtos = showtimes.flatMap(({ movieId, theaterId, id: showtimeId }) =>
        Seatmap.getAllSeats(seatmap).map((seat) => ({ movieId, theaterId, showtimeId, seat }))
    )

    const tickets = await createTickets(fix, createTicketDtos)

    return { customer, accessToken, refreshToken, movie, theaters, showtimes, tickets }
}

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
}

export const createFixture = async () => {
    const fix = await createCommonFixture()

    const teardown = async () => {
        await fix?.close()
    }

    return { ...fix, teardown }
}
