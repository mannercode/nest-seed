import { nullObjectId } from 'common'
import { ShowtimeCreationService } from 'services/showtime-creation'
import { createHttpTestContext, HttpTestClient, HttpTestContext } from 'testlib'
import { CoreModule } from '../../core'
import { ShowtimeCreationController } from '../showtime-creation.controller'

describe('ShowtimeCreationController', () => {
    let testContext: HttpTestContext
    let client: HttpTestClient
    let service: jest.Mocked<ShowtimeCreationService>

    beforeAll(async () => {
        testContext = await createHttpTestContext({
            imports: [CoreModule],
            controllers: [ShowtimeCreationController],
            providers: [
                {
                    provide: ShowtimeCreationService,
                    useValue: { createBatchShowtimes: jest.fn() }
                }
            ]
        })
        client = testContext.client
        service = testContext.module.get(ShowtimeCreationService)
    })

    afterAll(async () => {
        await testContext.close()
    })

    it('startTimes를 Date로 변환해야 한다', async () => {
        service.createBatchShowtimes.mockResolvedValue({ batchId: nullObjectId })

        await client
            .post('/showtime-creation/showtimes')
            .body({
                movieId: nullObjectId,
                theaterIds: [nullObjectId],
                durationMinutes: 1,
                startTimes: ['299912310900', '299912311100', '299912131300']
            })
            .accepted()

        expect(service.createBatchShowtimes).toHaveBeenCalledTimes(1)

        const calledWithDto = service.createBatchShowtimes.mock.calls[0][0]
        expect(calledWithDto.startTimes).toHaveLength(3)
        expect(calledWithDto.startTimes[0].getTime()).toEqual(
            new Date('2999-12-31T09:00').getTime()
        )
    })

    it('startTimes가 배열이 아니면 BAD_REQUEST(404)를 반환해야 한다', async () => {
        service.createBatchShowtimes.mockResolvedValue({ batchId: nullObjectId })

        await client
            .post('/showtime-creation/showtimes')
            .body({
                movieId: nullObjectId,
                theaterIds: [nullObjectId],
                durationMinutes: 1,
                startTimes: '299912311100'
            })
            .badRequest('startTimes must be an array')
    })
})
