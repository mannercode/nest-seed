import type { ShowtimesService, TicketsService } from 'core'
import { newObjectIdString, type CacheService } from '@mannercode/common'
import { nullObjectId } from '@mannercode/testing'
import type {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationEvent
} from '../../internal'
import type { ShowtimeCreationEvents } from '../../showtime-creation.events'
import type { LegacyShowtimeCreationWorkflowInput } from '../legacy-types'
import { LegacyShowtimeCreationActivities } from '../legacy-activities'

describe('LegacyShowtimeCreationActivities', () => {
    let activities: LegacyShowtimeCreationActivities
    let emitStatusChanged: jest.Mock
    let validate: jest.Mock
    let create: jest.Mock
    let deleteShowtimes: jest.Mock
    let deleteTickets: jest.Mock

    const input = (): LegacyShowtimeCreationWorkflowInput => ({
        createDto: {
            durationInMinutes: 1,
            movieId: nullObjectId,
            startTimes: [new Date('2100-01-01T09:00:00.000Z')],
            theaterIds: [nullObjectId]
        },
        sagaId: newObjectIdString()
    })

    beforeEach(() => {
        emitStatusChanged = jest.fn(async () => undefined)
        validate = jest.fn(async () => ({ conflictingShowtimes: [], isValid: true }))
        create = jest.fn(async () => ({ createdShowtimeCount: 1, createdTicketCount: 10 }))
        deleteShowtimes = jest.fn(async () => undefined)
        deleteTickets = jest.fn(async () => undefined)

        const cache = {
            withLockBlocking: jest.fn(async (_key: string, _ttlMs: number, fn: () => unknown) =>
                fn()
            )
        } as unknown as CacheService

        activities = new LegacyShowtimeCreationActivities(
            { emitStatusChanged } as unknown as ShowtimeCreationEvents,
            { validate } as unknown as ShowtimeBulkValidatorService,
            { create } as unknown as ShowtimeBulkCreatorService,
            { deleteBySagaIds: deleteShowtimes } as unknown as ShowtimesService,
            { deleteBySagaIds: deleteTickets } as unknown as TicketsService,
            cache
        )
    })

    it('bind한 상태 발행 Activity가 이벤트 서비스에 위임한다', async () => {
        const event: ShowtimeCreationEvent = { sagaId: newObjectIdString(), status: 'processing' }

        await activities.bind().emitStatusChanged(event)

        expect(emitStatusChanged).toHaveBeenCalledWith(event)
    })

    it('검증을 통과하면 v1 생성 결과를 반환한다', async () => {
        const workflowInput = input()

        await expect(activities.bind().validateAndCreate(workflowInput)).resolves.toEqual({
            createdShowtimeCount: 1,
            createdTicketCount: 10,
            kind: 'succeeded'
        })
        expect(validate).toHaveBeenCalledWith(workflowInput.createDto)
        expect(create).toHaveBeenCalledWith(workflowInput.createDto, workflowInput.sagaId)
    })

    it('충돌하면 생성하지 않고 v1 실패 결과를 반환한다', async () => {
        const conflict = {
            endTime: new Date('2100-01-01T10:00:00.000Z'),
            id: newObjectIdString(),
            movieId: nullObjectId,
            startTime: new Date('2100-01-01T09:00:00.000Z'),
            theaterId: nullObjectId
        }
        validate.mockResolvedValue({ conflictingShowtimes: [conflict], isValid: false })

        await expect(activities.validateAndCreate(input())).resolves.toEqual({
            conflictingShowtimes: [conflict],
            kind: 'failed'
        })
        expect(create).not.toHaveBeenCalled()
    })

    it('v1 보상은 tickets와 showtimes를 모두 삭제한다', async () => {
        const sagaId = newObjectIdString()

        await activities.bind().compensate(sagaId)

        expect(deleteTickets).toHaveBeenCalledWith([sagaId])
        expect(deleteShowtimes).toHaveBeenCalledWith([sagaId])
    })

    it('v1 보상 중 한 삭제가 실패해도 다른 삭제를 시도한 뒤 원인을 던진다', async () => {
        const sagaId = newObjectIdString()
        deleteShowtimes.mockRejectedValue(new Error('showtime cleanup failed'))

        await expect(activities.compensate(sagaId)).rejects.toThrow(
            `compensate failed (sagaId=${sagaId}): showtimes=showtime cleanup failed`
        )
        expect(deleteTickets).toHaveBeenCalledWith([sagaId])
    })
})
