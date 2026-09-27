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

    describe.each([
        {
            condition: 'Error 객체를 던지면',
            failure: new Error('database unavailable'),
            message: 'database unavailable'
        },
        {
            condition: '문자열을 던지면',
            failure: 'non-error rejection',
            message: 'non-error rejection'
        }
    ])('상영 저장이 $condition', ({ failure, message }) => {
        let fix: ReturnType<typeof createFixture>

        beforeEach(() => {
            fix = createFixture({ failure })
        })

        it('오류 메시지를 포함한 error 이벤트를 발행하고 같은 실행 결과를 반환한다', async () => {
            const terminal = await run(fix)

            expect(fix.events.at(-1)).toEqual({ message, sagaId: input.sagaId, status: 'error' })
            expect(terminal).toEqual({ message, sagaId: input.sagaId, status: 'error' })
        })
    })

    describe('상영 저장이 취소 오류를 던지면', () => {
        let failure: CancelledError
        let fix: ReturnType<typeof createFixture>
        beforeEach(() => {
            failure = new CancelledError()
            fix = createFixture({ failure })
        })
        it('error 이벤트를 발행하지 않고 취소 오류를 다시 던진다', async () => {
            await expect(run(fix)).rejects.toBe(failure)
            expect(fix.events.map(({ status }) => status)).toEqual(['waiting', 'processing'])
        })
    })

    describe('알림 발행과 상영 저장이 모두 실패하면', () => {
        let fix: ReturnType<typeof createFixture>
        beforeEach(() => {
            fix = createFixture({
                emitStatusChanged: async () => {
                    throw new Error('NATS unavailable')
                },
                failure: new Error('database unavailable')
            })
        })
        it('상영 저장의 실패 원인을 실행 결과에 담아 반환한다', async () => {
            await expect(run(fix)).resolves.toEqual({
                sagaId: input.sagaId,
                status: 'error',
                message: 'database unavailable'
            })
        })
    })

    describe('알림 발행이 취소 오류를 던지면', () => {
        let failure: CancelledError
        let fix: ReturnType<typeof createFixture>
        beforeEach(() => {
            failure = new CancelledError()
            fix = createFixture({
                emitStatusChanged: async () => {
                    throw failure
                }
            })
        })
        it('상영 저장을 시작하지 않고 취소 오류를 다시 던진다', async () => {
            await expect(run(fix)).rejects.toBe(failure)
            expect(fix.persistence).not.toHaveBeenCalled()
        })
    })

    describe('알림 발행이 끝나지 않으면', () => {
        let fix: ReturnType<typeof createFixture>

        beforeEach(() => {
            vi.useFakeTimers()
            fix = createFixture({
                emitStatusChanged: () => new Promise<void>(() => undefined),
                result: { conflictingShowtimes: [], kind: 'failed' }
            })
        })

        afterEach(() => vi.useRealTimers())

        it('대기 기한이 지나면 상영 저장을 실행하고 그 결과를 반환한다', async () => {
            const completion = run(fix)
            await vi.advanceTimersByTimeAsync(30_000)
            await expect(completion).resolves.toEqual({
                sagaId: input.sagaId,
                status: 'failed',
                conflictingShowtimes: []
            })
            expect(fix.persistence).toHaveBeenCalledOnce()
        })
    })

    describe('asTerminalError', () => {
        let classify: (error: unknown) => TerminalError | undefined

        beforeEach(() => {
            const fix = createFixture({ result: { kind: 'failed', conflictingShowtimes: [] } })
            const configured = fix.definition.options?.asTerminalError
            if (!configured) throw new Error('terminal error classifier is missing')
            classify = configured
        })

        describe.each([
            {
                condition: '잘못된 요청 예외가 발생했으면',
                failure: new BadRequestException('bad request'),
                expected: { code: 400, message: 'bad request' }
            },
            {
                condition: '자원을 찾을 수 없다는 예외가 발생했으면',
                failure: new NotFoundException('not found'),
                expected: { code: 404, message: 'not found' }
            }
        ])('$condition', ({ failure, expected }) => {
            let error: typeof failure
            beforeEach(() => {
                error = failure
            })
            it('오류를 분류하면 재시도하지 않는 오류로 변환한다', () => {
                const result = classify(error)

                expect(result).toBeInstanceOf(TerminalError)
                expect(result).toMatchObject(expected)
            })
        })

        describe('일반 Error가 발생했으면', () => {
            let error: Error
            beforeEach(() => {
                error = new Error('retry me')
            })
            it('오류를 분류하면 재시도 중단 오류로 변환하지 않는다', () => {
                expect(classify(error)).toBeUndefined()
            })
        })
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
