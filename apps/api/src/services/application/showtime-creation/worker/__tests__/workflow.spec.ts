import { instant } from '@mannercode/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { CancelledError, TerminalError, type WorkflowContext } from '@restatedev/restate-sdk'
import type { AppConfigService } from '#config'
import type {
    ShowtimeCreationEvent,
    ShowtimeCreationTerminalEvent,
    ValidateAndCreateResult
} from '../../internal/index.js'
import { TemporalJsonSerde } from '../temporal-json.serde.js'
import {
    createShowtimeCreationWorkflow,
    getShowtimeCreationWorkflowName,
    ShowtimeCreationWorkflow,
    type ShowtimeCreationWorkflowDefinition,
    type ShowtimeCreationWorkflowInput
} from '../index.js'

describe('Showtime creation Restate workflow', () => {
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
        expect(fix.runStep.mock.calls[0]?.[2]).toEqual({
            initialRetryInterval: 1_000,
            maxRetryAttempts: 3,
            maxRetryDuration: 35_000
        })
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

    it('상태 이벤트 발행 한 번이 10초를 넘으면 Restate 재시도로 넘긴다', async () => {
        vi.useFakeTimers()
        try {
            const fix = createFixture({
                emitStatusChanged: () => new Promise<void>(() => undefined),
                result: { conflictingShowtimes: [], kind: 'failed' }
            })
            const completion = run(fix).catch((error: unknown) => error)

            await vi.advanceTimersByTimeAsync(10_000)

            const failure = await completion
            expect(failure).toBeInstanceOf(Error)
            expect((failure as Error).message).toBe('Status event publish timed out after 10000ms.')
            expect(fix.runStep).toHaveBeenCalledTimes(1)
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
        return fix.definition.workflow.run(fix.context, input)
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
