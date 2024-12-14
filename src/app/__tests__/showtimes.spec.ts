import { addMinutes, pickIds } from 'common'
import { ShowtimeDto, ShowtimesService } from 'services/cores'
import { expectEqualUnsorted, nullObjectId, testObjectId } from 'testlib'
import {
    closeFixture,
    createFixture,
    createShowtimeDto,
    createShowtimeDtos,
    createShowtimes,
    Fixture
} from './showtimes.fixture'

describe('Showtimes Module', () => {
    let fixture: Fixture
    let service: ShowtimesService

    beforeEach(async () => {
        fixture = await createFixture()
        service = fixture.showtimesService
    })

    afterEach(async () => {
        await closeFixture(fixture)
    })

    it('createShowtimes', async () => {
        const { createDtos, expectedDtos } = createShowtimeDtos()

        const { success } = await service.createShowtimes(createDtos)
        expect(success).toBeTruthy()

        const showtimes = await service.findAllShowtimes({
            startTimeRange: { start: new Date(0), end: new Date('9999') }
        })

        expect(showtimes).toEqual(expectedDtos)
    })

    describe('findAllShowtimes', () => {
        beforeEach(async () => {
            const { createDtos } = createShowtimeDtos()
            const { success } = await service.createShowtimes(createDtos)
            expect(success).toBeTruthy()
        })

        const createAndFindShowtimes = async (overrides = {}, findFilter = {}) => {
            const { createDtos, expectedDtos } = createShowtimeDtos(overrides)
            const { success } = await service.createShowtimes(createDtos)
            expect(success).toBeTruthy()

            const showtimes = await service.findAllShowtimes(findFilter)
            expectEqualUnsorted(showtimes, expectedDtos)
        }

        it('batchIds', async () => {
            const batchId = testObjectId('a1')
            await createAndFindShowtimes({ batchId }, { batchIds: [batchId] })
        })

        it('movieIds', async () => {
            const movieId = testObjectId('a1')
            await createAndFindShowtimes({ movieId }, { movieIds: [movieId] })
        })

        it('theaterIds', async () => {
            const theaterId = testObjectId('a1')
            await createAndFindShowtimes({ theaterId }, { theaterIds: [theaterId] })
        })

        it('startTimeRange', async () => {
            const startTimeRange = {
                start: new Date(2000, 0, 1, 0, 0),
                end: new Date(2000, 0, 1, 49, 0)
            }

            const showtimes = await service.findAllShowtimes({ startTimeRange })
            expect(showtimes).toHaveLength(50)
        })

        it('1개 이상의 필터를 설정하지 않으면 BAD_REQUEST(400)를 반환해야 한다', async () => {
            const promise = createAndFindShowtimes({})
            await expect(promise).rejects.toThrow('At least one filter condition must be provided.')
        })
    })

    describe('getShowtimes', () => {
        let showtimes: ShowtimeDto[]

        beforeEach(async () => {
            const { createDtos } = createShowtimeDtos()
            showtimes = await createShowtimes(service, createDtos)
        })

        it('상영시간 정보를 가져와야 한다', async () => {
            const gotShowtime = await service.getShowtimes(pickIds(showtimes))
            expect(gotShowtime).toEqual(showtimes)
        })

        it('상영시간이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            const promise = service.getShowtimes([nullObjectId])
            await expect(promise).rejects.toThrow(`One or more Documents with IDs not found`)
        })
    })

    it('findShowingMovieIds', async () => {
        const movieIds = [testObjectId('a1'), testObjectId('a2')]
        const now = new Date()
        const createDtos = [
            createShowtimeDto({ startTime: addMinutes(now, -90), endTime: addMinutes(now, -30) }),
            createShowtimeDto({
                movieId: movieIds[0],
                startTime: addMinutes(now, 30),
                endTime: addMinutes(now, 90)
            }),
            createShowtimeDto({
                movieId: movieIds[1],
                startTime: addMinutes(now, 120),
                endTime: addMinutes(now, 150)
            })
        ]

        const { success } = await service.createShowtimes(createDtos)
        expect(success).toBeTruthy()

        const foundIds = await service.findShowingMovieIds()
        expect(foundIds).toEqual(movieIds)
    })

    it('findTheaterIdsByMovieId', async () => {
        const movieId = testObjectId('a1')
        const createDtos = [
            createShowtimeDto({
                movieId: testObjectId('a2'),
                theaterId: testObjectId('b1')
            }),
            createShowtimeDto({
                movieId,
                theaterId: testObjectId('b2')
            }),
            createShowtimeDto({
                movieId,
                theaterId: testObjectId('b3')
            })
        ]

        const { success } = await service.createShowtimes(createDtos)
        expect(success).toBeTruthy()

        const theaterIds = await service.findTheaterIdsByMovieId(movieId)
        expect(theaterIds).toEqual([testObjectId('b2'), testObjectId('b3')])
    })

    it('findShowdates', async () => {
        const movieId = testObjectId('a1')
        const theaterId = testObjectId('b1')
        const createDtos = [
            createShowtimeDto({
                movieId,
                theaterId,
                startTime: new Date('2000-01-02'),
                endTime: new Date('2000-01-03')
            }),
            createShowtimeDto({
                movieId,
                theaterId,
                startTime: new Date('2000-01-04'),
                endTime: new Date('2000-01-04')
            }),
            createShowtimeDto({
                movieId,
                theaterId: testObjectId('A1'),
                startTime: new Date('2000-01-05'),
                endTime: new Date('2000-01-06')
            })
        ]

        const { success } = await service.createShowtimes(createDtos)
        expect(success).toBeTruthy()

        const showdates = await service.findShowdates({ movieId, theaterId })
        expect(showdates.map((showdate) => showdate.getTime())).toEqual([
            new Date('2000-01-02').getTime(),
            new Date('2000-01-04').getTime()
        ])
    })
})
