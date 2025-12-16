import { ShowtimeDto } from 'apps/cores'
import { DateUtil } from 'common'
import request from 'superagent'
import { nullObjectId } from 'testlib'
import { createShowtimes } from '../__helpers__'
import { ShowtimeCreationFixture, waitForCompletion } from './showtime-creation.fixture'

describe('ShowtimeCreationService', () => {
    let fix: ShowtimeCreationFixture

    beforeEach(async () => {
        const { createShowtimeCreationFixture } = await import('./showtime-creation.fixture')
        fix = await createShowtimeCreationFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('GET /showtime-creation/movies', () => {
        it('returns movies with default pagination', async () => {
            await fix.httpClient
                .get('/showtime-creation/movies')
                .ok({ skip: 0, take: expect.any(Number), total: 1, items: [fix.movie] })
        })
    })

    describe('GET /showtime-creation/theaters', () => {
        it('returns theaters with default pagination', async () => {
            await fix.httpClient
                .get('/showtime-creation/theaters')
                .ok({ skip: 0, take: expect.any(Number), total: 1, items: [fix.theater] })
        })
    })

    describe('POST /showtime-creation/showtimes:search', () => {
        describe('when showtimes exist for the theater', () => {
            let showtimes: ShowtimeDto[]

            beforeEach(async () => {
                showtimes = await createShowtimes(
                    fix,
                    [
                        new Date('2100-01-01T09:00'),
                        new Date('2100-01-01T11:00'),
                        new Date('2100-01-01T13:00')
                    ].map((startTime) => ({ theaterId: fix.theater.id, startTime }))
                )
            })

            it('returns showtimes for the theaterIds', async () => {
                await fix.httpClient
                    .post('/showtime-creation/showtimes:search')
                    .body({ theaterIds: [fix.theater.id] })
                    .ok(expect.arrayContaining(showtimes))
            })
        })
    })

    describe('POST /showtime-creation/showtimes', () => {
        it('returns a sagaId', async () => {
            await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body({
                    movieId: fix.movie.id,
                    theaterIds: [fix.theater.id],
                    startTimes: [new Date('2100-01-01T09:00')],
                    durationInMinutes: 1
                })
                .accepted({ sagaId: expect.any(String) })
        })

        describe('when showtime creation is requested', () => {
            let requestPromise: Promise<request.Response>

            beforeEach(async () => {
                requestPromise = fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .body({
                        movieId: fix.movie.id,
                        theaterIds: [fix.theater.id],
                        startTimes: [new Date('2100-01-01T09:00')],
                        durationInMinutes: 1
                    })
                    .accepted()
            })

            it('streams saga status updates', async () => {
                const promise = new Promise((resolve, reject) => {
                    fix.httpClient.get('/showtime-creation/event-stream').sse((data) => {
                        const result = JSON.parse(data)

                        if (['succeeded', 'failed', 'error'].includes(result.status)) {
                            fix.httpClient.abort()

                            if ('succeeded' === result.status) {
                                resolve(result)
                            } else {
                                reject(result)
                            }
                        }
                    }, reject)
                })

                const { body } = await requestPromise

                await expect(promise).resolves.toEqual(
                    expect.objectContaining({ sagaId: body.sagaId, status: 'succeeded' })
                )
            })

            it('creates showtimes', async () => {
                const { body } = await requestPromise
                const { createdShowtimeCount } = await waitForCompletion(fix, 'succeeded')

                const showtimes = await fix.showtimesClient.search({ sagaIds: [body.sagaId] })
                expect(showtimes).toHaveLength(createdShowtimeCount)
            })

            it('creates tickets', async () => {
                const { body } = await requestPromise
                const { createdTicketCount } = await waitForCompletion(fix, 'succeeded')

                const tickets = await fix.ticketsClient.search({ sagaIds: [body.sagaId] })
                expect(tickets).toHaveLength(createdTicketCount)
            })
        })

        it('reports an error for a missing movie', async () => {
            const waitPromise = waitForCompletion(fix, 'error')

            const { body } = await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body({
                    movieId: nullObjectId,
                    theaterIds: [fix.theater.id],
                    startTimes: [new Date(0)],
                    durationInMinutes: 1
                })
                .accepted()

            await expect(waitPromise).resolves.toEqual({
                sagaId: body.sagaId,
                status: 'error',
                message: 'The requested movie could not be found.'
            })
        })

        it('reports an error for a missing theater', async () => {
            const waitPromise = waitForCompletion(fix, 'error')

            const { body } = await fix.httpClient
                .post('/showtime-creation/showtimes')
                .body({
                    movieId: fix.movie.id,
                    theaterIds: [nullObjectId],
                    startTimes: [new Date(0)],
                    durationInMinutes: 1
                })
                .accepted()

            await expect(waitPromise).resolves.toEqual({
                sagaId: body.sagaId,
                status: 'error',
                message: 'One or more requested theaters could not be found.'
            })
        })

        describe('when showtimes conflict', () => {
            let initialShowtimes: ShowtimeDto[]

            beforeEach(async () => {
                initialShowtimes = await createShowtimes(
                    fix,
                    [
                        new Date('2013-01-31T12:00'),
                        new Date('2013-01-31T14:00'),
                        new Date('2013-01-31T16:30'),
                        new Date('2013-01-31T18:30')
                    ].map((startTime) => ({
                        theaterId: fix.theater.id,
                        startTime,
                        endTime: DateUtil.add({ base: startTime, minutes: 90 })
                    }))
                )
            })

            it('returns the conflicting showtimes', async () => {
                const waitPromise = waitForCompletion(fix, 'failed')

                await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .body({
                        movieId: fix.movie.id,
                        theaterIds: [fix.theater.id],
                        startTimes: [
                            new Date('2013-01-31T12:00'),
                            new Date('2013-01-31T16:00'),
                            new Date('2013-01-31T20:00')
                        ],
                        durationInMinutes: 30
                    })
                    .accepted()

                const conflictingShowtimes = [
                    initialShowtimes[0],
                    initialShowtimes[2],
                    initialShowtimes[3]
                ]

                await expect(waitPromise).resolves.toEqual({
                    sagaId: expect.any(String),
                    status: 'failed',
                    conflictingShowtimes
                })
            })
        })
    })
})
