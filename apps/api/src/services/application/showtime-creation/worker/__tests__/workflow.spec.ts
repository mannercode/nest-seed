import { instant } from '@mannercode/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { CancelledError, TerminalError, type WorkflowContext } from '@restatedev/restate-sdk'
import type { AppConfigService } from '#config'
import type {
    ShowtimeCreationEvent,
    ShowtimeCreationTerminalEvent,
    ValidateAndCreateResult
} from '../../internal/index.js'
import { TemporalJsonSerde } from '@mannercode/common'
import {
    createShowtimeCreationWorkflow,
    getShowtimeCreationWorkflowName,
    ShowtimeCreationWorkflow,
    type ShowtimeCreationWorkflowDefinition,
    type ShowtimeCreationWorkflowInput
} from '../index.js'

describe('createShowtimeCreationWorkflow', () => {
    const input = {
        createDto: {
            durationInMinutes: 90,
            movieId: 'movie-id',
            startTimes: [instant('2100-01-01T09:00:00.000Z')],
            theaterIds: ['theater-id']
        },
        sagaId: 'saga-id'
    }

    it('project별 workflow 이름을 만든다', () => {
        expect(getShowtimeCreationWorkflowName('project-a')).toBe('ShowtimeCreation-project-a')
    })

    it('waiting → processing → succeeded를 durable step으로 실행한다', async () => {
        const result: ValidateAndCreateResult = {
            createdShowtimeCount: 2,
            createdTicketCount: 20,
            kind: 'succeeded'
        }
        const fix = createFixture({ result })

        const terminal = await run(fix)

        expect(fix.events).toEqual([
            { sagaId: input.sagaId, status: 'waiting' },
            { sagaId: input.sagaId, status: 'processing' },
            {
                createdShowtimeCount: 2,
                createdTicketCount: 20,
                sagaId: input.sagaId,
                status: 'succeeded'
            }
        ])
        expect(fix.persistence).toHaveBeenCalledWith(
            expect.objectContaining({ startTimes: [expect.any(Temporal.Instant)] }),
            input.sagaId,
            expect.any(AbortSignal)
        )
        expect(fix.runStep.mock.calls.map(([name]) => name)).toEqual([
            'emit waiting',
            'emit processing',
            'validate and create',
            'emit succeeded'
        ])
        expect(fix.runStep.mock.calls[0]?.[2]).toEqual({ maxRetryAttempts: 1 })
        expect(fix.runStep.mock.calls[2]?.[2]).toEqual({
            initialRetryInterval: 1_000,
            maxRetryAttempts: 4,
            maxRetryDuration: 195_000
        })
        expect(terminal).toEqual({
            createdShowtimeCount: 2,
            createdTicketCount: 20,
            sagaId: input.sagaId,
            status: 'succeeded'
        })
    })

    it('업무 충돌은 failed 상태로 끝낸다', async () => {
        const conflictingShowtimes = [
            {
                endTime: Temporal.Instant.from('2100-01-01T11:00:00Z'),
                id: 'conflict',
                movieId: 'movie-id',
                startTime: Temporal.Instant.from('2100-01-01T09:00:00Z'),
                theaterId: 'theater-id'
            }
        ]
        const fix = createFixture({
            result: { conflictingShowtimes, kind: 'failed' },
            roundTripRunResult: true
        })

        const terminal = await run(fix)

        expect(fix.events.at(-1)).toEqual({
            conflictingShowtimes,
            sagaId: input.sagaId,
            status: 'failed'
        })
        const failed = fix.events.at(-1)
        if (failed?.status !== 'failed') throw new Error('Expected a failed workflow event.')
        expect(failed.conflictingShowtimes[0]?.startTime).toBeInstanceOf(Temporal.Instant)
        expect(terminal).toEqual(failed)
    })

    it.each([
        [new Error('database unavailable'), 'database unavailable'],
        ['non-error rejection', 'non-error rejection']
    ])('실행 오류 %p를 error 상태로 바꾼다', async (failure, message) => {
        const fix = createFixture({ failure })

        const terminal = await run(fix)

        expect(fix.events.at(-1)).toEqual({ message, sagaId: input.sagaId, status: 'error' })
        expect(terminal).toEqual({ message, sagaId: input.sagaId, status: 'error' })
    })

    it('취소는 error 이벤트로 바꾸지 않고 다시 던진다', async () => {
        const failure = new CancelledError()
        const fix = createFixture({ failure })

        await expect(run(fix)).rejects.toBe(failure)
        expect(fix.events.map(({ status }) => status)).toEqual(['waiting', 'processing'])
    })

    it('진행 알림이 실패해도 DB 작업과 종결 결과는 유지한다', async () => {
        const fix = createFixture({
            emitStatusChanged: async () => {
                throw new Error('NATS unavailable')
            },
            result: { kind: 'succeeded', createdShowtimeCount: 2, createdTicketCount: 20 }
        })
        await expect(run(fix)).resolves.toEqual({
            sagaId: input.sagaId,
            status: 'succeeded',
            createdShowtimeCount: 2,
            createdTicketCount: 20
        })
        expect(fix.persistence).toHaveBeenCalledOnce()
    })

    it('업무 실패를 알리는 발행 오류가 원래 실패 결과를 덮지 않는다', async () => {
        const fix = createFixture({
            emitStatusChanged: async () => {
                throw new Error('NATS unavailable')
            },
            failure: new Error('database unavailable')
        })
        await expect(run(fix)).resolves.toEqual({
            sagaId: input.sagaId,
            status: 'error',
            message: 'database unavailable'
        })
    })

    it('알림 도중 workflow 취소는 다시 던진다', async () => {
        const failure = new CancelledError()
        const fix = createFixture({
            emitStatusChanged: async () => {
                throw failure
            }
        })
        await expect(run(fix)).rejects.toBe(failure)
        expect(fix.persistence).not.toHaveBeenCalled()
    })

    it('발행이 멈춰도 각 10초 제한 후 업무를 진행하고 결과를 반환한다', async () => {
        vi.useFakeTimers()
        try {
            const fix = createFixture({
                emitStatusChanged: () => new Promise<void>(() => undefined),
                result: { conflictingShowtimes: [], kind: 'failed' }
            })
            const completion = run(fix)
            await vi.advanceTimersByTimeAsync(30_000)
            await expect(completion).resolves.toEqual({
                sagaId: input.sagaId,
                status: 'failed',
                conflictingShowtimes: []
            })
            expect(fix.persistence).toHaveBeenCalledOnce()
            expect(fix.runStep).toHaveBeenCalledTimes(4)
        } finally {
            vi.useRealTimers()
        }
    })

    it('업무 예외만 Restate terminal error로 분류한다', () => {
        const fix = createFixture({ result: { kind: 'failed', conflictingShowtimes: [] } })
        const classify = fix.definition.options?.asTerminalError
        if (!classify) throw new Error('terminal error classifier is missing')

        const badRequest = classify(new BadRequestException('bad request'))
        const notFound = classify(new NotFoundException('not found'))

        expect(badRequest).toBeInstanceOf(TerminalError)
        expect(badRequest).toMatchObject({ code: 400, message: 'bad request' })
        expect(notFound).toBeInstanceOf(TerminalError)
        expect(notFound).toMatchObject({ code: 404, message: 'not found' })
        expect(classify(new Error('retry me'))).toBeUndefined()
    })

    it('기본 timeout과 명시한 테스트 timeout을 workflow 옵션에 반영한다', () => {
        const defaults = createFixture({ result: { kind: 'failed', conflictingShowtimes: [] } })
        const shortened = createFixture({
            result: { kind: 'failed', conflictingShowtimes: [] },
            runTimeoutMs: 123
        })

        expect(defaults.definition.options).toMatchObject({
            abortTimeout: 5_000,
            inactivityTimeout: 65_000,
            serde: TemporalJsonSerde,
            workflowRetention: 3_600_000
        })
        expect(shortened.definition.options).toMatchObject({ inactivityTimeout: 5_123 })
    })

    it('Nest 제공자는 설정의 project ID로 definition을 만든다', () => {
        const workflow = new ShowtimeCreationWorkflow(
            { emitStatusChanged: vi.fn() } as never,
            { validateAndCreate: vi.fn() } as never,
            { projectId: 'nest-project' } as AppConfigService
        )

        expect(workflow.definition.name).toBe('ShowtimeCreation-nest-project')
    })

    type FixtureOptions = {
        emitStatusChanged?: (event: ShowtimeCreationEvent) => Promise<void>
        failure?: unknown
        result?: ValidateAndCreateResult
        roundTripRunResult?: boolean
        runTimeoutMs?: number
    }

    function createFixture({
        emitStatusChanged,
        failure,
        result,
        roundTripRunResult = false,
        runTimeoutMs
    }: FixtureOptions) {
        const events: ShowtimeCreationEvent[] = []
        let defaultSerde: typeof TemporalJsonSerde | undefined
        const persistence = vi.fn(async () => {
            // workflow가 외부 promise의 비표준 rejection도 안전하게 상태로 바꾸는지 검증한다.
            if (failure !== undefined) throw failure
            if (result === undefined) throw new Error('Fixture result is required.')
            return result
        })
        const runStep = vi.fn(async (name: string, action: () => unknown, _options: unknown) => {
            const value = await action()
            if (!roundTripRunResult || name !== 'validate and create') return value
            if (!defaultSerde) throw new Error('Workflow default serde is required.')
            return defaultSerde.deserialize(defaultSerde.serialize(value))
        })
        const context = {
            request: () => ({ attemptCompletedSignal: new AbortController().signal }),
            run: runStep
        } as unknown as WorkflowContext
        const definition = createShowtimeCreationWorkflow({
            events: {
                emitStatusChanged:
                    emitStatusChanged ??
                    (async (event) => {
                        events.push(event)
                    })
            },
            persistence: { validateAndCreate: persistence },
            projectId: 'unit-test',
            runTimeoutMs
        })
        const runtimeDefinition = definition as unknown as RuntimeWorkflowDefinition
        defaultSerde = runtimeDefinition.options?.serde

        return { context, definition: runtimeDefinition, events, persistence, runStep }
    }

    function run(fix: ReturnType<typeof createFixture>) {
        const wireInput = TemporalJsonSerde.deserialize(TemporalJsonSerde.serialize(input))
        return fix.definition.workflow.run(fix.context, wireInput as ShowtimeCreationWorkflowInput)
    }

    type RuntimeWorkflowDefinition = ShowtimeCreationWorkflowDefinition & {
        options?: {
            abortTimeout?: number
            asTerminalError?: (error: unknown) => TerminalError | undefined
            inactivityTimeout?: number
            serde?: typeof TemporalJsonSerde
            workflowRetention?: number
        }
        workflow: {
            run: (
                context: WorkflowContext,
                input: ShowtimeCreationWorkflowInput
            ) => Promise<ShowtimeCreationTerminalEvent>
        }
    }
})
