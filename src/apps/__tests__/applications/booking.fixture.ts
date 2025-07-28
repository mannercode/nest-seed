import { MovieDto, Seatmap, ShowtimeDto, TheaterDto } from 'apps/cores'
import {
    buildCreateTicketDto,
    createCustomerAndLogin,
    createMovie,
    createShowtimes,
    createTheater,
    createTickets
} from '../__fixtures__'
import { CommonFixture, createCommonFixture } from '../__helpers__'

const createTheaters = async (fix: CommonFixture) => {
    const theaters = await Promise.all([
        createTheater(fix, { location: { latitude: 30.0, longitude: 130.0 } }),
        createTheater(fix, { location: { latitude: 31.0, longitude: 131.0 } }),
        createTheater(fix, { location: { latitude: 32.0, longitude: 132.0 } }),
        createTheater(fix, { location: { latitude: 33.0, longitude: 133.0 } }),
        createTheater(fix, { location: { latitude: 34.0, longitude: 134.0 } })
    ])

    return theaters
}

const createAllShowtimes = async (fix: CommonFixture, theaters: TheaterDto[], movie: MovieDto) => {
    const startTimes = [
        new Date('2999-01-01T12:00'),
        new Date('2999-01-01T14:00'),
        new Date('2999-01-03T12:00'),
        new Date('2999-01-02T14:00')
    ]

    const createDtos = startTimes.flatMap((startTime) =>
        theaters.map((theater) => ({
            movieId: movie.id,
            theaterId: theater.id,
            startTime
        }))
    )

    const showtimes = await createShowtimes(fix, createDtos)
    return showtimes
}

const createAllTickets = async (
    fix: CommonFixture,
    theaters: TheaterDto[],
    showtimes: ShowtimeDto[]
) => {
    const theatersById = new Map(theaters.map((theater) => [theater.id, theater]))

    const createTicketDtos = showtimes.flatMap(({ movieId, theaterId, id: showtimeId }) => {
        const theater = theatersById.get(theaterId)!

        return Seatmap.getAllSeats(theater.seatmap).map((seat) =>
            buildCreateTicketDto({ movieId, theaterId, showtimeId, seat })
        )
    })

    await createTickets(fix, createTicketDtos)
}

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    movie: MovieDto
    accessToken: string
}

export const createFixture = async () => {
    const fix = await createCommonFixture()

    const { accessToken } = await createCustomerAndLogin(fix)

    const theaters = await createTheaters(fix)
    const movie = await createMovie(fix)
    const showtimes = await createAllShowtimes(fix, theaters, movie)
    await createAllTickets(fix, theaters, showtimes)

    const teardown = async () => {
        await fix?.close()
    }

    return { ...fix, teardown, movie, accessToken }
}
