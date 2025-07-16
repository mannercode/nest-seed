import { ShowtimeDto } from 'apps/cores'
import { DateUtil, pickIds } from 'common'
import { expectEqualUnsorted, nullObjectId, testObjectId } from 'testlib'
import { buildCreateShowtimeDto, createShowtimes } from '../common.fixture'
import { buildCreateShowtimeDtos, Fixture } from './showtimes.fixture'

describe('Showtimes', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./showtimes.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    it('createShowtimes', async () => {
        const { createDto, expectedDto } = buildCreateShowtimeDto({
            transactionId: testObjectId(0x1)
        })

        const { success } = await fix.showtimesClient.createShowtimes([createDto])
        expect(success).toBeTruthy()

        const showtimes = await fix.showtimesClient.searchShowtimes({
            transactionIds: [testObjectId(0x1)]
        })

        expect(showtimes).toEqual([expectedDto])
    })

    describe('searchShowtimes', () => {
        const transactionId = testObjectId(0x1)
        const movieId = testObjectId(0x2)
        const theaterId = testObjectId(0x3)
        const startTimes = [
            new Date('2000-01-01T12:00'),
            new Date('2000-01-01T14:00'),
            new Date('2000-01-02T14:00'),
            new Date('2000-01-03T12:00')
        ]

        let expectedDtos: ShowtimeDto[]

        beforeEach(async () => {
            const result = buildCreateShowtimeDtos(startTimes, {
                transactionId,
                movieId,
                theaterId
            })

            const { success } = await fix.showtimesClient.createShowtimes(result.createDtos)
            expect(success).toBeTruthy()
            expectedDtos = result.expectedDtos
        })

        it('transactionIds', async () => {
            const showtimes = await fix.showtimesClient.searchShowtimes({
                transactionIds: [transactionId]
            })
            expectEqualUnsorted(showtimes, expectedDtos)
        })

        it('movieIds', async () => {
            const showtimes = await fix.showtimesClient.searchShowtimes({ movieIds: [movieId] })
            expectEqualUnsorted(showtimes, expectedDtos)
        })

        it('theaterIds', async () => {
            const showtimes = await fix.showtimesClient.searchShowtimes({
                theaterIds: [theaterId]
            })
            expectEqualUnsorted(showtimes, expectedDtos)
        })

        it('startTimeRange', async () => {
            const startTimeRange = {
                start: new Date('2000-01-01T00:00'),
                end: new Date('2000-01-02T12:00')
            }

            const showtimes = await fix.showtimesClient.searchShowtimes({ startTimeRange })
            expect(showtimes).toHaveLength(2)
        })

        // 1개 이상의 필터를 설정하지 않으면 BAD_REQUEST(400)를 반환해야 한다
        it('Should return BAD_REQUEST(400) if no filter is provided', async () => {
            const promise = fix.showtimesClient.searchShowtimes({})
            await expect(promise).rejects.toThrow('At least one filter condition must be provided')
        })
    })

    describe('getShowtimes', () => {
        let showtimes: ShowtimeDto[]

        beforeEach(async () => {
            const { createDtos } = buildCreateShowtimeDtos([
                new Date('2000-01-01T12:00'),
                new Date('2000-01-01T14:00'),
                new Date('2000-01-02T14:00'),
                new Date('2000-01-03T12:00')
            ])

            showtimes = await createShowtimes(fix, createDtos)
        })

        // 상영시간 상세 정보를 반환해야 한다
        it('Should return showtime details', async () => {
            const gotShowtime = await fix.showtimesClient.getShowtimes(pickIds(showtimes))
            expect(gotShowtime).toEqual(showtimes)
        })

        // 상영시간이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다
        it('Should return NOT_FOUND(404) if the showtime does not exist', async () => {
            const promise = fix.showtimesClient.getShowtimes([nullObjectId])
            await expect(promise).rejects.toThrow('One or more documents not found')
        })
    })

    it('searchShowingMovieIds', async () => {
        const now = new Date()

        const buildCreateDto = (movieId: string, startTime: Date) =>
            buildCreateShowtimeDto({
                movieId,
                startTime,
                endTime: DateUtil.addMinutes(startTime, 1)
            }).createDto

        const createDtos = [
            buildCreateDto(testObjectId(0x1), DateUtil.addMinutes(now, -90)),
            buildCreateDto(testObjectId(0x2), DateUtil.addMinutes(now, 30)),
            buildCreateDto(testObjectId(0x3), DateUtil.addMinutes(now, 120))
        ]

        const { success } = await fix.showtimesClient.createShowtimes(createDtos)
        expect(success).toBeTruthy()

        const foundMovieIds = await fix.showtimesClient.searchShowingMovieIds()
        expect(foundMovieIds).toEqual([testObjectId(0x2), testObjectId(0x3)])
    })

    it('searchTheaterIds', async () => {
        const movieId = testObjectId(0x10)

        const buildCreateDto = (movieId: string, theaterId: string) =>
            buildCreateShowtimeDto({ movieId, theaterId }).createDto

        const createDtos = [
            buildCreateDto(movieId, testObjectId(0x1)),
            buildCreateDto(movieId, testObjectId(0x2)),
            buildCreateDto(nullObjectId, testObjectId(0x3))
        ]

        const { success } = await fix.showtimesClient.createShowtimes(createDtos)
        expect(success).toBeTruthy()

        const foundTheaterIds = await fix.showtimesClient.searchTheaterIds({ movieIds: [movieId] })
        expect(foundTheaterIds).toEqual([testObjectId(0x1), testObjectId(0x2)])
    })

    it('searchShowdates', async () => {
        const movieId = testObjectId(0x1)
        const theaterId = testObjectId(0x2)

        const buildCreateDto = (theaterId: string, startTime: Date) =>
            buildCreateShowtimeDto({ movieId, theaterId, startTime, endTime: startTime }).createDto

        const createDtos = [
            buildCreateDto(theaterId, new Date('2000-01-01')),
            buildCreateDto(theaterId, new Date('2000-01-02')),
            buildCreateDto(nullObjectId, new Date('2000-01-03'))
        ]

        const { success } = await fix.showtimesClient.createShowtimes(createDtos)
        expect(success).toBeTruthy()

        const showdates = await fix.showtimesClient.searchShowdates({
            movieIds: [movieId],
            theaterIds: [theaterId]
        })
        expect(showdates.map((showdate) => showdate.getTime())).toEqual([
            new Date('2000-01-01').getTime(),
            new Date('2000-01-02').getTime()
        ])
    })
})
