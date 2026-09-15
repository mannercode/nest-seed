import { instant } from '@mannercode/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { CancelledError, TerminalError, type WorkflowContext } from '@restatedev/restate-sdk'
import type {
    ShowtimeCreationEvent,
    ShowtimeCreationTerminalEvent,
    ValidateAndCreateResult
} from '../../internal/index.js'
import {
    createShowtimeCreationWorkflow,
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

    type FixtureOptions = {
        emitStatusChanged?: (event: ShowtimeCreationEvent) => Promise<void>
        failure?: unknown
        result?: ValidateAndCreateResult
    }

    function createFixture({ emitStatusChanged, failure, result }: FixtureOptions) {
        const events: ShowtimeCreationEvent[] = []
        const persistence = vi.fn(async () => {
            // workflow가 외부 promise의 비표준 rejection도 안전하게 상태로 바꾸는지 검증한다.
            if (failure !== undefined) throw failure
            if (result === undefined) throw new Error('Fixture result is required.')
            return result
        })
        const context = {
            request: () => ({ attemptCompletedSignal: new AbortController().signal }),
            run: async (_name: string, action: () => unknown) => action()
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
            projectId: 'unit-test'
        })
        const runtimeDefinition = definition as unknown as RuntimeWorkflowDefinition

        return { context, definition: runtimeDefinition, events, persistence }
    }

    function run(fix: ReturnType<typeof createFixture>) {
        return fix.definition.workflow.run(fix.context, input)
    }

    type RuntimeWorkflowDefinition = ShowtimeCreationWorkflowDefinition & {
        options?: { asTerminalError?: (error: unknown) => TerminalError | undefined }
        workflow: {
            run: (
                context: WorkflowContext,
                input: ShowtimeCreationWorkflowInput
            ) => Promise<ShowtimeCreationTerminalEvent>
        }
    }
})
