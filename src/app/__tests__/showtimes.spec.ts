import { ShowtimeDto, ShowtimesService } from 'services/showtimes'
import {
    closeIsolatedFixture,
    createIsolatedFixture,
    createShowtimes,
    createShowtimeDtos,
    IsolatedFixture
} from './showtimes.fixture'
import { addMinutes, nullObjectId, pickIds, pickItems } from 'common'

describe('ShowtimesModule', () => {
    let isolated: IsolatedFixture
    let service: ShowtimesService

    beforeEach(async () => {
        isolated = await createIsolatedFixture()
        service = isolated.service
    })

    afterEach(async () => {
        await closeIsolatedFixture(isolated)
    })

    it('createShowtimes', async () => {
        const { creationDtos, expectedDtos } = createShowtimeDtos()

        const showtimes = await createShowtimes(service, creationDtos)
        expect(showtimes).toEqual(expectedDtos)
    })

    describe('findAllShowtimes', () => {
        let showtimes: ShowtimeDto[]

        beforeEach(async () => {
            const { creationDtos } = createShowtimeDtos()
            showtimes = await createShowtimes(service, creationDtos)
        })

        const findAllShowtimes = async (overrides = {}) => {
            const { creationDtos, expectedDtos } = createShowtimeDtos(overrides)
            await service.createShowtimes(creationDtos)

            const showtimes = await service.findAllShowtimes(overrides)
            expect(showtimes).toEqual(expectedDtos)
        }

        it('batchId', async () => {
            const batchId = '100000000000000000000001'
            await findAllShowtimes({ batchId })
        })

        it('movieId', async () => {
            const movieId = '100000000000000000000002'
            await findAllShowtimes({ movieId })
        })

        it('theaterId', async () => {
            const theaterId = '100000000000000000000003'
            await findAllShowtimes({ theaterId })
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
            const promise = findAllShowtimes({})
            await expect(promise).rejects.toThrow('At least one filter condition must be provided.')
        })
    })

    describe('getShowtime', () => {
        let showtimes: ShowtimeDto[]

        beforeEach(async () => {
            const { creationDtos } = createShowtimeDtos()
            showtimes = await createShowtimes(service, creationDtos)
        })

        it('상영시간 정보를 가져와야 한다', async () => {
            const gotShowtime = await service.getShowtime(showtimes[0].id)
            expect(gotShowtime).toEqual(showtimes[0])
        })

        it('상영시간이 존재하지 않으면 NOT_FOUND(404)를 반환해야 한다', async () => {
            const promise = service.getShowtime(nullObjectId)
            await expect(promise).rejects.toThrow(
                'Showtime with ID 000000000000000000000000 not found'
            )
        })
    })

    it('findShowingMovieIds', async () => {
        const base = {
            batchId: '000000000000000000000001',
            movieId: '000000000000000000000002',
            theaterId: '000000000000000000000003'
        }

        const now = new Date()
        const creationDtos = [
            {
                ...base,
                startTime: addMinutes(now, -90),
                endTime: addMinutes(now, -30)
            },
            {
                ...base,
                movieId: '100000000000000000000001',
                startTime: addMinutes(now, 30),
                endTime: addMinutes(now, 90)
            },
            {
                ...base,
                movieId: '100000000000000000000002',
                startTime: addMinutes(now, 120),
                endTime: addMinutes(now, 150)
            }
        ]

        const { success } = await service.createShowtimes(creationDtos)
        expect(success).toBeTruthy()

        const movieIds = await service.findShowingMovieIds()
        expect(movieIds).toEqual(['100000000000000000000001', '100000000000000000000002'])
    })

    it('findTheaterIdsShowingMovie', async () => {
        const base = {
            batchId: '000000000000000000000001',
            startTime: new Date(0),
            endTime: new Date(0)
        }

        const movieId = '100000000000000000000002'
        const creationDtos = [
            {
                ...base,
                movieId: '100000000000000000000001',
                theaterId: '200000000000000000000001'
            },
            {
                ...base,
                movieId,
                theaterId: '200000000000000000000002'
            },
            {
                ...base,
                movieId,
                theaterId: '200000000000000000000003'
            }
        ]

        const { success } = await service.createShowtimes(creationDtos)
        expect(success).toBeTruthy()

        const theaterIds = await service.findTheaterIdsShowingMovie(movieId)
        expect(theaterIds).toEqual(['200000000000000000000002', '200000000000000000000003'])
    })

    it('findShowdates', async () => {
        const base = {
            batchId: '000000000000000000000001',
            movieId: '000000000000000000000002',
            theaterId: '000000000000000000000003'
        }

        const creationDtos = [
            {
                ...base,
                startTime: new Date('2000-01-02'),
                endTime: new Date('2000-01-03')
            },
            {
                ...base,
                startTime: new Date('2000-01-04'),
                endTime: new Date('2000-01-04')
            },
            {
                ...base,
                theaterId: '000000000000000000000000',
                startTime: new Date('2000-01-05'),
                endTime: new Date('2000-01-06')
            }
        ]

        const { success } = await service.createShowtimes(creationDtos)
        expect(success).toBeTruthy()

        const showdates = await service.findShowdates(base.movieId, base.theaterId)
        expect(showdates.map((showdate) => showdate.getTime())).toEqual([
            new Date('2000-01-02').getTime(),
            new Date('2000-01-04').getTime()
        ])
    })
})
