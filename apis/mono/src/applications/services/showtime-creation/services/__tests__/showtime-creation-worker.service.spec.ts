import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { ShowtimeCreationWorkerService } from '../showtime-creation-worker.service'
import { ShowtimeCreationJobData } from '../types'

describe('ShowtimeCreationWorkerService', () => {
    describe('process - compensation failure', () => {
        // compensation 중 서비스가 실패하면 실패 이유를 로그에 남긴다
        it('logs failure reason when a compensation dependency rejects', async () => {
            const validationError = new Error('validation failed')
            const ticketsDeleteError = new Error('tickets delete failed')

            const validatorService = { validate: jest.fn().mockRejectedValue(validationError) }
            const creatorService = { create: jest.fn() }
            const events = { emitStatusChanged: jest.fn() }
            const showtimesService = {
                deleteBySagaIds: jest.fn().mockResolvedValue({ deletedCount: 0 })
            }
            const ticketsService = {
                deleteBySagaIds: jest.fn().mockRejectedValue(ticketsDeleteError)
            }
            const queue = {}

            const service = new ShowtimeCreationWorkerService(
                validatorService as any,
                creatorService as any,
                events as any,
                showtimesService as any,
                ticketsService as any,
                queue as any
            )

            const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

            const job = {
                data: { createDto: {}, sagaId: 'test-saga-id' }
            } as Job<ShowtimeCreationJobData>

            await service.process(job)

            const errorCalls = errorSpy.mock.calls.map((args) => JSON.stringify(args))
            const hasReasonLogged = errorCalls.some((c) => c.includes('tickets delete failed'))

            expect(hasReasonLogged).toBe(true)

            errorSpy.mockRestore()
        })
    })
})
