import type { ShowtimeDto } from 'core'
import { newObjectIdString } from '@mannercode/common'
import { nullObjectId, withTestId } from '@mannercode/testing'
import { Client, Connection } from '@temporalio/client'
import { NativeConnection, Worker } from '@temporalio/worker'
import { readFileSync } from 'fs'
import type { ShowtimeCreationEvent } from '../../internal'
import type { ValidateAndCreateResult } from '../activities'
import type { ShowtimeCreationWorkflowInput } from '../types'
import { showtimeCreationBundle } from '../bundle'

/**
 * 워크플로의 오케스트레이션 로직만 격리해 검증한다.
 * 액티비티를 mock으로 대체하므로 DB·락·NATS 없이 분기, 보상 호출, 재시도, 호출 순서를 직접 단언할 수 있다.
 * 실제 액티비티 본문과 인프라 연동은 통합 테스트(showtime-creation.spec)가 따로 덮는다.
 *
 * 워크플로 본문은 `bundleWorkflowCode`가 만든 샌드박스 안에서 돌아 Istanbul 계측이 닿지 않는다.
 * 그래서 실제 Temporal에 워커를 붙여 워크플로를 끝까지 실행시키되, 액티비티만 mock으로 주입한다.
 */
type WorkflowActivities = {
    compensate: (sagaId: string) => Promise<void>
    emitStatusChanged: (payload: ShowtimeCreationEvent) => Promise<void>
    validateAndCreate: (input: ShowtimeCreationWorkflowInput) => Promise<ValidateAndCreateResult>
}

const address = `${process.env.TEMPORAL_HOST}:${process.env.TEMPORAL_PORT}`
const namespace = process.env.TEMPORAL_NAMESPACE as string

describe('showtimeCreationWorkflow', () => {
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

    // 매 테스트마다 고유 task queue의 워커를 띄워 mock 액티비티로 워크플로를 한 번 실행한다.
    // `runUntil`은 워크플로가 끝나면 워커를 정리한다.
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
            client.workflow.execute('showtimeCreationWorkflow', {
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
        const validateAndCreate = jest.fn(
            async (): Promise<ValidateAndCreateResult> => ({
                createdShowtimeCount: 3,
                createdTicketCount: 30,
                kind: 'succeeded'
            })
        )
        const compensate = jest.fn(async () => {})
        const emitStatusChanged = jest.fn(async (payload: ShowtimeCreationEvent) => {
            statuses.push(payload)
        })

        const input = buildInput()
        await runWorkflow(input, { compensate, emitStatusChanged, validateAndCreate })

        expect(validateAndCreate).toHaveBeenCalledTimes(1)
        expect(compensate).not.toHaveBeenCalled()
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
        const validateAndCreate = jest.fn(
            async (): Promise<ValidateAndCreateResult> => ({
                conflictingShowtimes: conflicting,
                kind: 'failed'
            })
        )
        const compensate = jest.fn(async () => {})
        const emitStatusChanged = jest.fn(async (payload: ShowtimeCreationEvent) => {
            statuses.push(payload)
        })

        const input = buildInput()
        await runWorkflow(input, { compensate, emitStatusChanged, validateAndCreate })

        expect(compensate).not.toHaveBeenCalled()
        expect(statuses.map((s) => s.status)).toEqual(['processing', 'failed'])

        const failed = statuses[1]
        expect(failed?.status).toBe('failed')
        if (failed?.status === 'failed') {
            expect(failed.sagaId).toBe(input.sagaId)
            expect(failed.conflictingShowtimes).toHaveLength(1)
        }
    })

    it('validateAndCreate가 실패하면 보상한 뒤 오류 상태를 알린다', async () => {
        // 보상이 오류 알림보다 먼저 일어나야 한다.
        // 알림이 먼저 나가면 클라이언트가 정리 완료로 오인할 수 있다.
        const timeline: string[] = []
        const validateAndCreate = jest.fn(async (): Promise<ValidateAndCreateResult> => {
            throw new Error('boom during create')
        })
        const compensate = jest.fn(async () => {
            timeline.push('compensate')
        })
        const emitStatusChanged = jest.fn(async (payload: ShowtimeCreationEvent) => {
            timeline.push(`emit:${payload.status}`)
        })

        const input = buildInput()
        await runWorkflow(input, { compensate, emitStatusChanged, validateAndCreate })

        // 검증·생성은 자동 재시도를 끄므로 한 번만 실행되어야 한다(재시도 시 중복 생성 위험).
        expect(validateAndCreate).toHaveBeenCalledTimes(1)
        expect(compensate).toHaveBeenCalledWith(input.sagaId)
        expect(timeline).toEqual(['emit:processing', 'compensate', 'emit:error'])

        const errorEvent = emitStatusChanged.mock.calls
            .map((call) => call[0])
            .find((payload) => payload.status === 'error')
        expect(errorEvent).toBeDefined()
        if (errorEvent) {
            expect(errorEvent.sagaId).toBe(input.sagaId)
            expect(errorEvent.message).toContain('boom during create')
        }
    })

    it('상태 알림이 일시적으로 실패해도 재시도해 사가를 끝까지 진행한다', async () => {
        // emitStatusChanged는 자동 재시도하므로, 첫 시도가 실패해도 다음 시도에서 회복되어야 한다.
        const recorded: string[] = []
        let processingAttempts = 0
        const validateAndCreate = jest.fn(
            async (): Promise<ValidateAndCreateResult> => ({
                createdShowtimeCount: 1,
                createdTicketCount: 1,
                kind: 'succeeded'
            })
        )
        const compensate = jest.fn(async () => {})
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
        await runWorkflow(input, { compensate, emitStatusChanged, validateAndCreate })

        expect(processingAttempts).toBeGreaterThanOrEqual(2)
        expect(recorded).toEqual(['processing', 'succeeded'])
        expect(compensate).not.toHaveBeenCalled()
    })
})
