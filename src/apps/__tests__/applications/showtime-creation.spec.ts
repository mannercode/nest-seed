import { ShowtimeDto } from 'apps/cores'
import { DateUtil } from 'common'
import type { Response } from 'superagent'
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
        describe('when the pagination query is not provided', () => {
            it('returns movies with default pagination', async () => {
                await fix.httpClient
                    .get('/showtime-creation/movies')
                    .ok({ skip: 0, take: expect.any(Number), total: 1, items: [fix.movie] })
            })
        })
    })

    describe('GET /showtime-creation/theaters', () => {
        describe('when the pagination query is not provided', () => {
            it('returns theaters with default pagination', async () => {
                await fix.httpClient
                    .get('/showtime-creation/theaters')
                    .ok({ skip: 0, take: expect.any(Number), total: 1, items: [fix.theater] })
            })
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
        describe('when showtime creation is requested', () => {
            let createPromise: Promise<Response>

            beforeEach(async () => {
                createPromise = fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .body({
                        movieId: fix.movie.id,
                        theaterIds: [fix.theater.id],
                        startTimes: [new Date('2100-01-01T09:00')],
                        durationInMinutes: 1
                    })
                    .accepted()
            })

            it('returns a sagaId', async () => {
                const { body } = await createPromise
                expect(body).toEqual(expect.objectContaining({ sagaId: expect.any(String) }))
            })

            it('streams saga status updates', async () => {
                const eventPromise = new Promise((resolve, reject) => {
                    fix.httpClient.get('/showtime-creation/event-stream').sse((data) => {
                        const statusUpdate = JSON.parse(data)

                        if (['succeeded', 'failed', 'error'].includes(statusUpdate.status)) {
                            fix.httpClient.abort()

                            if ('succeeded' === statusUpdate.status) {
                                resolve(statusUpdate)
                            } else {
                                reject(statusUpdate)
                            }
                        }
                    }, reject)
                })

                const { body } = await createPromise

                await expect(eventPromise).resolves.toEqual(
                    expect.objectContaining({ sagaId: body.sagaId, status: 'succeeded' })
                )
            })

            it('creates showtimes', async () => {
                const { body } = await createPromise
                const { createdShowtimeCount } = await waitForCompletion(fix, 'succeeded')

                const createdShowtimes = await fix.showtimesClient.search({
                    sagaIds: [body.sagaId]
                })
                expect(createdShowtimes).toHaveLength(createdShowtimeCount)
            })

            it('creates tickets', async () => {
                const { body } = await createPromise
                const { createdTicketCount } = await waitForCompletion(fix, 'succeeded')

                const createdTickets = await fix.ticketsClient.search({ sagaIds: [body.sagaId] })
                expect(createdTickets).toHaveLength(createdTicketCount)
            })
        })

        describe('when the movie does not exist', () => {
            it('reports an error', async () => {
                const completionPromise = waitForCompletion(fix, 'error')

                const { body } = await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .body({
                        movieId: nullObjectId,
                        theaterIds: [fix.theater.id],
                        startTimes: [new Date(0)],
                        durationInMinutes: 1
                    })
                    .accepted()

                await expect(completionPromise).resolves.toEqual({
                    sagaId: body.sagaId,
                    status: 'error',
                    message: 'The requested movie could not be found.'
                })
            })
        })

        describe('when the theater does not exist', () => {
            it('reports an error', async () => {
                const completionPromise = waitForCompletion(fix, 'error')

                const { body } = await fix.httpClient
                    .post('/showtime-creation/showtimes')
                    .body({
                        movieId: fix.movie.id,
                        theaterIds: [nullObjectId],
                        startTimes: [new Date(0)],
                        durationInMinutes: 1
                    })
                    .accepted()

                await expect(completionPromise).resolves.toEqual({
                    sagaId: body.sagaId,
                    status: 'error',
                    message: 'One or more requested theaters could not be found.'
                })
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
                const completionPromise = waitForCompletion(fix, 'failed')

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

                await expect(completionPromise).resolves.toEqual({
                    sagaId: expect.any(String),
                    status: 'failed',
                    conflictingShowtimes
                })
            })
        })
    })
})
