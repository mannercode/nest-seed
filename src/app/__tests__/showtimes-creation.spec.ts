import {
    HttpClient,
    HttpTestContext,
    createHttpTestContext,
    createMicroserviceTestContext,
    expectEqualUnsorted,
    nullObjectId
} from 'common'
import { MovieDto } from 'services/movies'
import { ShowtimeDto } from 'services/showtimes'
import { TheaterDto } from 'services/theaters'
import { GatewayModule } from '../gateway.module'
import { createMovie } from './movies.fixture'
import {
    castForShowtimes,
    castForTickets,
    createShowtimes,
    errorShowtimes,
    failShowtimes,
    makeCreateShowtimesDto
} from './showtimes-creation.fixture'
import { createTheaters } from './theaters.fixture'
import { Config } from 'config'
import { ServicesModule } from 'services/services.module'

describe('showtimes-creation', () => {
    let testContext: HttpTestContext
    let client: HttpClient
    let closeInfra: () => Promise<void>
    let movie: MovieDto
    let theaters: TheaterDto[]

    beforeEach(async () => {
        const { port, close } = await createMicroserviceTestContext({ imports: [ServicesModule] })
        closeInfra = close
        Config.service.port = port

        testContext = await createHttpTestContext({ imports: [GatewayModule] })
        client = testContext.client
        movie = await createMovie(client)
        theaters = await createTheaters(client, 2)
    })

    afterEach(async () => {
        await testContext?.close()
        await closeInfra()
    })

    it('enter showtimes for the selected movie', async () => {
        const { createDto, expectedShowtimes, expectedTickets } = makeCreateShowtimesDto(
            movie,
            theaters,
            { startTimes: [new Date('2000-01-31T14:00'), new Date('2000-01-31T16:00')] }
        )

        const { showtimes, tickets } = await createShowtimes(client, createDto)

        expectEqualUnsorted(showtimes, expectedShowtimes)
        expectEqualUnsorted(tickets, expectedTickets)
    })

    it('should successfully complete all requests when multiple creation requests occur simultaneously', async () => {
        const length = 100

        const p1 = castForShowtimes(client, length)
        const p2 = castForTickets(client, length)

        const results = await Promise.all(
            Array.from({ length }, async (_, index) => {
                const { createDto, expectedShowtimes, expectedTickets } = makeCreateShowtimesDto(
                    movie,
                    theaters,
                    { startTimes: [new Date(1900, index)] }
                )

                await client.post('/showtimes').body(createDto).accepted()

                return { expectedShowtimes, expectedTickets }
            })
        )

        const showtimesMap = await p1
        const ticketsMap = await p2

        expectEqualUnsorted(
            Array.from(showtimesMap.values()).flat(),
            results.flatMap((result) => result.expectedShowtimes)
        )
        expectEqualUnsorted(
            Array.from(ticketsMap.values()).flat(),
            results.flatMap((result) => result.expectedTickets)
        )
    })

    describe('conflict checking', () => {
        let createdShowtimes: ShowtimeDto[]

        beforeEach(async () => {
            const { createDto } = makeCreateShowtimesDto(movie, theaters, {
                durationMinutes: 90,
                startTimes: [
                    new Date('2013-01-31T12:00'),
                    new Date('2013-01-31T14:00'),
                    new Date('2013-01-31T16:30'),
                    new Date('2013-01-31T18:30')
                ]
            })

            const { showtimes } = await createShowtimes(client, createDto)
            createdShowtimes = showtimes
        })

        it('should return conflict information when creation request conflicts with existing showtimes', async () => {
            const { createDto } = makeCreateShowtimesDto(movie, theaters, {
                durationMinutes: 30,
                startTimes: [
                    new Date('2013-01-31T12:00'),
                    new Date('2013-01-31T16:00'),
                    new Date('2013-01-31T20:00')
                ]
            })

            const { conflictShowtimes } = await failShowtimes(client, createDto)

            const expectedShowtimes = createdShowtimes.filter((showtime) =>
                [
                    new Date('2013-01-31T12:00').getTime(),
                    new Date('2013-01-31T16:30').getTime(),
                    new Date('2013-01-31T18:30').getTime()
                ].includes(showtime.startTime.getTime())
            )

            expectEqualUnsorted(conflictShowtimes, expectedShowtimes)
        })
    })

    describe('error handling', () => {
        const expected = { batchId: expect.any(String), status: 'error' }

        it('should return NOT_FOUND(404) when movieId is not found', async () => {
            const { createDto } = makeCreateShowtimesDto({ id: nullObjectId } as MovieDto, theaters)

            const error = await errorShowtimes(client, createDto)

            expect(error).toEqual({
                ...expected,
                message: 'Movie with ID 000000000000000000000000 not found'
            })
        })

        it('should return NOT_FOUND(404) when theaterId is not found', async () => {
            const { createDto } = makeCreateShowtimesDto(movie, [
                { id: nullObjectId } as TheaterDto
            ])

            const error = await errorShowtimes(client, createDto)

            expect(error).toEqual({
                ...expected,
                message: 'Theater with IDs 000000000000000000000000 not found'
            })
        })

        it('should return NOT_FOUND(404) when any theaterId in the list is not found', async () => {
            const { createDto } = makeCreateShowtimesDto(movie, [
                theaters[0],
                { id: nullObjectId } as TheaterDto
            ])

            const error = await errorShowtimes(client, createDto)

            expect(error).toEqual({
                ...expected,
                message: expect.any(String)
            })
        })
    })
})
