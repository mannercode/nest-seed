import { BulkCreateShowtimesDto } from 'apps/applications'
import { Seatmap, ShowtimeDto } from 'apps/cores'
import { DateUtil } from 'common'
import { nullObjectId } from 'testlib'
import { createShowtimes } from '../__helpers__'
import {
    buildBulkCreateShowtimesDto,
    Fixture,
    waitForCompletion
} from './showtime-creation.fixture'

describe('ShowtimeCreationService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./showtime-creation.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('GET /showtime-creation/movies', () => {
        // 쿼리 파라미터가 없는 경우
        describe('when query parameters are missing', () => {
            // 기본 페이지네이션으로 영화를 반환한다
            it('returns movies with default pagination', async () => {
                await fixture.httpClient
                    .get('/showtime-creation/movies')
                    .ok({ skip: 0, take: expect.any(Number), total: 1, items: [fixture.movie] })
            })
        })
    })

    describe('GET /showtime-creation/theaters', () => {
        // 쿼리 파라미터가 없는 경우
        describe('when query parameters are missing', () => {
            // 기본 페이지네이션으로 극장을 반환한다
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

        // `theaterIds`가 제공된 경우
        describe('when `theaterIds` are provided', () => {
            // 지정한 theaterIds와 일치하는 상영시간 목록을 반환한다
            it('returns showtimes for the theaterIds', async () => {
                await fixture.httpClient
                    .post('/showtime-creation/showtimes:search')
                    .body({ theaterIds: [fixture.theater.id] })
                    .ok(expect.arrayContaining(showtimes))
            })
        })
    })

    describe('POST /showtime-creation/showtimes', () => {
        // payload가 유효한 경우
        describe('when payload is valid', () => {
            let createDto: BulkCreateShowtimesDto
            let transactionId: string
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

                transactionId = body.transactionId
                result = await waitPromise
            })

            // TODO fix
            // transactionId를 반환한다
            it('returns a transactionId', async () => {
                expect(transactionId).toBeDefined()
            })

            // 상영시간 생성 성공 이벤트를 방출한다
            it('emits a showtime creation success event', async () => {
                const { theaterIds, startTimes } = createDto

                const createdShowtimeCount = theaterIds.length * startTimes.length
                const seatCount = Seatmap.getSeatCount(fixture.theater.seatmap)
                const createdTicketCount = createdShowtimeCount * seatCount

                expect(result).toEqual({
                    transactionId,
                    status: 'succeeded',
                    createdShowtimeCount,
                    createdTicketCount
                })
            })
        })

        // 영화가 존재하지 않는 경우
        describe('when movie does not exist', () => {
            // 존재하지 않는 영화 오류를 보고한다
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
                    transactionId: body.transactionId,
                    status: 'error',
                    message: 'The requested movie could not be found.'
                })
            })
        })

        // 극장이 존재하지 않는 경우
        describe('when a theater does not exist', () => {
            // 존재하지 않는 극장 오류를 보고한다
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
                    transactionId: body.transactionId,
                    status: 'error',
                    message: 'One or more requested theaters could not be found.'
                })
            })
        })

        // 상영시간이 충돌하는 경우
        describe('when showtimes conflict', () => {
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

            // 충돌하는 상영시간을 반환한다
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
                    .accepted({ transactionId: expect.any(String) })

                const conflictingShowtimes = [
                    initialShowtimes[0],
                    initialShowtimes[2],
                    initialShowtimes[3]
                ]

                await expect(waitPromise).resolves.toEqual({
                    transactionId: expect.any(String),
                    status: 'failed',
                    conflictingShowtimes
                })
            })
        })
    })
})
