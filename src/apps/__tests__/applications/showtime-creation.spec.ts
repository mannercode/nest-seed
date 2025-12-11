import { BulkCreateShowtimesDto } from 'apps/applications'
import { Seatmap, ShowtimeDto } from 'apps/cores'
import { DateUtil } from 'common'
import { nullObjectId } from 'testlib'
import { createShowtimes } from '../__helpers__'
import {
    buildBulkCreateShowtimesDto,
    ShowtimeCreationFixture,
    waitForCompletion
} from './showtime-creation.fixture'

describe('ShowtimeCreationService', () => {
    let fixture: ShowtimeCreationFixture

    beforeEach(async () => {
        const { createShowtimeCreationFixture } = await import('./showtime-creation.fixture')
        fixture = await createShowtimeCreationFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('GET /showtime-creation/movies', () => {
        describe('when the query parameters are missing', () => {
            it('returns movies with default pagination', async () => {
                await fixture.httpClient
                    .get('/showtime-creation/movies')
                    .ok({ skip: 0, take: expect.any(Number), total: 1, items: [fixture.movie] })
            })
        })
    })

    describe('GET /showtime-creation/theaters', () => {
        describe('when the query parameters are missing', () => {
            it('returns theaters with default pagination', async () => {
                await fixture.httpClient
                    .get('/showtime-creation/theaters')
                    .ok({ skip: 0, take: expect.any(Number), total: 1, items: [fixture.theater] })
            })
        })
    })

    describe('POST /showtime-creation/showtimes:search', () => {
        let showtimes: ShowtimeDto[]

        beforeEach(async () => {
            const createDtos = [
                new Date('2100-01-01T09:00'),
                new Date('2100-01-01T11:00'),
                new Date('2100-01-01T13:00')
            ].map((startTime) => ({ theaterId: fixture.theater.id, startTime }))

            showtimes = await createShowtimes(fixture, createDtos)
        })

        describe('when the `theaterIds` are provided', () => {
            it('returns showtimes for the theaterIds', async () => {
                await fixture.httpClient
                    .post('/showtime-creation/showtimes:search')
                    .body({ theaterIds: [fixture.theater.id] })
                    .ok(expect.arrayContaining(showtimes))
            })
        })
    })

    describe('POST /showtime-creation/showtimes', () => {
        describe('when the payload is valid', () => {
            let createDto: BulkCreateShowtimesDto
            let sagaId: string
            let result: unknown

            beforeEach(async () => {
                const waitPromise = waitForCompletion(fixture, 'succeeded')

                createDto = buildBulkCreateShowtimesDto({
                    movieId: fixture.movie.id,
                    theaterIds: [fixture.theater.id],
                    startTimes: [new Date('2100-01-01T09:00'), new Date('2100-01-01T11:00')]
                })

                const { body } = await fixture.httpClient
                    .post('/showtime-creation/showtimes')
                    .body(createDto)
                    .accepted()

                sagaId = body.sagaId
                result = await waitPromise
            })

            // TODO fix
            it('returns a sagaId', async () => {
                expect(sagaId).toBeDefined()
            })

            it('emits a showtime creation success event', async () => {
                const { theaterIds, startTimes } = createDto

                const createdShowtimeCount = theaterIds.length * startTimes.length
                const seatCount = Seatmap.getSeatCount(fixture.theater.seatmap)
                const createdTicketCount = createdShowtimeCount * seatCount

                expect(result).toEqual({
                    sagaId,
                    status: 'succeeded',
                    createdShowtimeCount,
                    createdTicketCount
                })
            })
        })

        describe('when the movie does not exist', () => {
            it('reports the missing movie error', async () => {
                const waitPromise = waitForCompletion(fixture, 'error')

                const createDto = buildBulkCreateShowtimesDto({
                    movieId: nullObjectId,
                    theaterIds: [fixture.theater.id]
                })

                const { body } = await fixture.httpClient
                    .post('/showtime-creation/showtimes')
                    .body(createDto)
                    .accepted()

                await expect(waitPromise).resolves.toEqual({
                    sagaId: body.sagaId,
                    status: 'error',
                    message: 'The requested movie could not be found.'
                })
            })
        })

        describe('when a theater does not exist', () => {
            it('reports the missing theater error', async () => {
                const waitPromise = waitForCompletion(fixture, 'error')

                const createDto = buildBulkCreateShowtimesDto({
                    movieId: fixture.movie.id,
                    theaterIds: [nullObjectId]
                })

                const { body } = await fixture.httpClient
                    .post('/showtime-creation/showtimes')
                    .body(createDto)
                    .accepted()

                await expect(waitPromise).resolves.toEqual({
                    sagaId: body.sagaId,
                    status: 'error',
                    message: 'One or more requested theaters could not be found.'
                })
            })
        })

        describe('when the showtimes conflict', () => {
            let initialShowtimes: ShowtimeDto[]

            beforeEach(async () => {
                const createDtos = [
                    new Date('2013-01-31T12:00'),
                    new Date('2013-01-31T14:00'),
                    new Date('2013-01-31T16:30'),
                    new Date('2013-01-31T18:30')
                ].map((startTime) => ({
                    theaterId: fixture.theater.id,
                    startTime,
                    endTime: DateUtil.add({ base: startTime, minutes: 90 })
                }))

                initialShowtimes = await createShowtimes(fixture, createDtos)
            })

            it('returns the conflicting showtimes', async () => {
                const waitPromise = waitForCompletion(fixture, 'failed')

                const createDto = buildBulkCreateShowtimesDto({
                    movieId: fixture.movie.id,
                    theaterIds: [fixture.theater.id],
                    startTimes: [
                        new Date('2013-01-31T12:00'),
                        new Date('2013-01-31T16:00'),
                        new Date('2013-01-31T20:00')
                    ],
                    durationInMinutes: 30
                })

                await fixture.httpClient
                    .post('/showtime-creation/showtimes')
                    .body(createDto)
                    .accepted({ sagaId: expect.any(String) })

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
