import type { ShowtimeDto } from 'core'
import { newObjectIdString } from '@mannercode/common'
import { nullObjectId, withTestId } from '@mannercode/testing'
import { Client, Connection, WorkflowFailedError } from '@temporalio/client'
import { NativeConnection, Worker } from '@temporalio/worker'
import { readFileSync } from 'fs'
import type { ShowtimeCreationEvent } from '../../internal'
import type { ValidateAndCreateResult } from '../activities'
import type { ShowtimeCreationWorkflowInput } from '../types'
import { showtimeCreationBundle } from '../bundle'

// 샌드박스 워크플로는 Istanbul이 계측할 수 없어 실제 Temporal 워커에 mock 액티비티를 주입한다.
type WorkflowActivities = {
    emitStatusChanged: (payload: ShowtimeCreationEvent) => Promise<void>
    validateAndCreate: (input: ShowtimeCreationWorkflowInput) => Promise<ValidateAndCreateResult>
}

const address = `${process.env.TEMPORAL_HOST}:${process.env.TEMPORAL_PORT}`
const namespace = process.env.TEMPORAL_NAMESPACE as string

describe('showtimeCreationWorkflowV2', () => {
    let connection: Connection
    let nativeConnection: NativeConnection
    let client: Client
    let bundleCode: string

    beforeAll(async () => {
        connection = await Connection.connect({ address })
        nativeConnection = await NativeConnection.connect({ address })
        client = new Client({ connection, namespace })
        bundleCode = readFileSync(showtimeCreationBundle.bundlePath, 'utf8')
    }, 60_000)

    afterAll(async () => {
        await connection.close()
        await nativeConnection.close()
    })

    async function runWorkflow(
        input: ShowtimeCreationWorkflowInput,
        activities: WorkflowActivities
    ) {
        const taskQueue = withTestId('showtime-creation-unit')
        const worker = await Worker.create({
            activities,
            connection: nativeConnection,
            namespace,
            taskQueue,
            workflowBundle: { code: bundleCode }
        })

        await worker.runUntil(
            client.workflow.execute('showtimeCreationWorkflowV2', {
                args: [input],
                taskQueue,
                workflowId: withTestId('showtime-creation-wf')
            })
        )
    }

    function buildInput(): ShowtimeCreationWorkflowInput {
        return {
            createDto: {
                durationInMinutes: 1,
                movieId: nullObjectId,
                startTimes: [new Date('2100-01-01T09:00')],
                theaterIds: [nullObjectId]
            },
            sagaId: newObjectIdString()
        }
    }

    it('성공하면 processing 다음 생성 수와 함께 succeeded 상태를 알린다', async () => {
        const statuses: ShowtimeCreationEvent[] = []
        const validateAndCreate = jest.fn(async (): Promise<ValidateAndCreateResult> => ({
            createdShowtimeCount: 3,
            createdTicketCount: 30,
            kind: 'succeeded'
        }))
        const emitStatusChanged = jest.fn(async (payload: ShowtimeCreationEvent) => {
            statuses.push(payload)
        })

        const input = buildInput()
        await runWorkflow(input, { emitStatusChanged, validateAndCreate })

        expect(validateAndCreate).toHaveBeenCalledTimes(1)
        expect(statuses.map((s) => s.status)).toEqual(['processing', 'succeeded'])

        const succeeded = statuses[1]
        expect(succeeded?.status).toBe('succeeded')
        if (succeeded?.status === 'succeeded') {
            expect(succeeded.sagaId).toBe(input.sagaId)
            expect(succeeded.createdShowtimeCount).toBe(3)
            expect(succeeded.createdTicketCount).toBe(30)
        }
    })

    it('충돌하면 보상 없이 충돌 목록과 함께 failed 상태를 알린다', async () => {
        const conflicting: ShowtimeDto[] = [
            {
                endTime: new Date('2013-01-31T13:30:00.000Z'),
                id: nullObjectId,
                movieId: nullObjectId,
                startTime: new Date('2013-01-31T12:00:00.000Z'),
                theaterId: nullObjectId
            }
        ]
        const statuses: ShowtimeCreationEvent[] = []
        const validateAndCreate = jest.fn(async (): Promise<ValidateAndCreateResult> => ({
            conflictingShowtimes: conflicting,
            kind: 'failed'
        }))
        const emitStatusChanged = jest.fn(async (payload: ShowtimeCreationEvent) => {
            statuses.push(payload)
        })

        const input = buildInput()
        await runWorkflow(input, { emitStatusChanged, validateAndCreate })

        expect(statuses.map((s) => s.status)).toEqual(['processing', 'failed'])

        const failed = statuses[1]
        expect(failed?.status).toBe('failed')
        if (failed?.status === 'failed') {
            expect(failed.sagaId).toBe(input.sagaId)
            expect(failed.conflictingShowtimes).toHaveLength(1)
        }
    })

    it('validateAndCreate가 재시도를 소진하면 오류 상태를 알린다', async () => {
        const timeline: string[] = []
        const validateAndCreate = jest.fn(async (): Promise<ValidateAndCreateResult> => {
            throw new Error('boom during create')
        })
        const emitStatusChanged = jest.fn(async (payload: ShowtimeCreationEvent) => {
            timeline.push(`emit:${payload.status}`)
        })

        const input = buildInput()
        await runWorkflow(input, { emitStatusChanged, validateAndCreate })

        // 검증·생성은 sagaId로 멱등이므로 일시 장애를 위해 정해진 횟수만 재시도한다.
        expect(validateAndCreate).toHaveBeenCalledTimes(4)
        expect(timeline).toEqual(['emit:processing', 'emit:error'])

        const errorEvent = emitStatusChanged.mock.calls
            .map((call) => call[0])
            .find((payload) => payload.status === 'error')
        expect(errorEvent).toBeDefined()
        if (errorEvent) {
            expect(errorEvent.sagaId).toBe(input.sagaId)
            expect(errorEvent.message).toContain('boom during create')
        }
    })

    it('validateAndCreate가 일시적으로 실패해도 재시도해 성공한다', async () => {
        const statuses: ShowtimeCreationEvent[] = []
        const validateAndCreate = jest
            .fn(async (): Promise<ValidateAndCreateResult> => ({
                createdShowtimeCount: 1,
                createdTicketCount: 10,
                kind: 'succeeded'
            }))
            .mockRejectedValueOnce(new Error('stale compatibility lock'))
            .mockRejectedValueOnce(new Error('stale compatibility lock'))
            .mockRejectedValueOnce(new Error('stale compatibility lock'))
        const emitStatusChanged = jest.fn(async (payload: ShowtimeCreationEvent) => {
            statuses.push(payload)
        })

        const input = buildInput()
        await runWorkflow(input, { emitStatusChanged, validateAndCreate })

        expect(validateAndCreate).toHaveBeenCalledTimes(4)
        expect(statuses.map((status) => status.status)).toEqual(['processing', 'succeeded'])
    })

    it('시작된 시도가 heartbeat 없이 멈춰도 timeout 뒤 다음 시도로 회복한다', async () => {
        const statuses: ShowtimeCreationEvent[] = []
        const succeeded: ValidateAndCreateResult = {
            createdShowtimeCount: 1,
            createdTicketCount: 10,
            kind: 'succeeded'
        }
        let releaseFirst: (() => void) | undefined
        const validateAndCreate = jest.fn(async (): Promise<ValidateAndCreateResult> => {
            if (validateAndCreate.mock.calls.length === 1) {
                return new Promise<ValidateAndCreateResult>((resolve) => {
                    releaseFirst = () => resolve(succeeded)
                })
            }

            // timeout된 첫 handler도 종료시켜 Worker가 drain될 수 있게 한다. 늦은 완료 보고는 Temporal이 무시한다.
            releaseFirst?.()
            return succeeded
        })
        const emitStatusChanged = jest.fn(async (payload: ShowtimeCreationEvent) => {
            statuses.push(payload)
        })

        const input = buildInput()
        await runWorkflow(input, { emitStatusChanged, validateAndCreate })

        expect(validateAndCreate).toHaveBeenCalledTimes(2)
        expect(statuses.map((status) => status.status)).toEqual(['processing', 'succeeded'])
    }, 45_000)

    it('성공 상태 발행이 재시도를 소진하면 error로 바꾸지 않고 워크플로 실패로 남긴다', async () => {
        const statuses: ShowtimeCreationEvent[] = []
        const validateAndCreate = jest.fn(async (): Promise<ValidateAndCreateResult> => ({
            createdShowtimeCount: 1,
            createdTicketCount: 1,
            kind: 'succeeded'
        }))
        const emitStatusChanged = jest.fn(async (payload: ShowtimeCreationEvent) => {
            if (payload.status === 'succeeded') {
                throw new Error('terminal publish keeps failing')
            }
            statuses.push(payload)
        })

        const input = buildInput()
        await expect(runWorkflow(input, { emitStatusChanged, validateAndCreate })).rejects.toThrow(
            WorkflowFailedError
        )

        expect(
            emitStatusChanged.mock.calls.filter(([payload]) => payload.status === 'succeeded')
        ).toHaveLength(3)
        expect(statuses.map((s) => s.status)).toEqual(['processing'])
    })

    it('상태 알림이 일시적으로 실패해도 재시도해 사가를 끝까지 진행한다', async () => {
        // emitStatusChanged는 자동 재시도하므로, 첫 시도가 실패해도 다음 시도에서 회복되어야 한다.
        const recorded: string[] = []
        let processingAttempts = 0
        const validateAndCreate = jest.fn(async (): Promise<ValidateAndCreateResult> => ({
            createdShowtimeCount: 1,
            createdTicketCount: 1,
            kind: 'succeeded'
        }))
        const emitStatusChanged = jest.fn(async (payload: ShowtimeCreationEvent) => {
            if (payload.status === 'processing') {
                processingAttempts++
                if (processingAttempts === 1) {
                    throw new Error('transient publish failure')
                }
            }
            recorded.push(payload.status)
        })

        const input = buildInput()
        await runWorkflow(input, { emitStatusChanged, validateAndCreate })

        expect(processingAttempts).toBeGreaterThanOrEqual(2)
        expect(recorded).toEqual(['processing', 'succeeded'])
    })
})
