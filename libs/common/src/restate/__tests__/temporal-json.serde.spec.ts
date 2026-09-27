import { z } from 'zod'
import { CancelledError, TerminalError, type WorkflowContext } from '@restatedev/restate-sdk'
import { instant, plainDate } from '@mannercode/testing'
import { TemporalJsonSerde, defineWorkflow, isWorkflowCancellation } from '../index.js'

describe('TemporalJsonSerde', () => {
    it('Temporal 값을 JSON 문자열로 저장하고 다시 읽을 때는 문자열을 유지한다', () => {
        const value = { date: plainDate('2025-01-02'), timestamp: instant('2025-01-02T03:04:00Z') }

        const serialized = TemporalJsonSerde.serialize(value)

        expect(new TextDecoder().decode(serialized)).toBe(
            '{"date":"2025-01-02","timestamp":"2025-01-02T03:04:00.000Z"}'
        )
        expect(TemporalJsonSerde.deserialize(serialized)).toEqual({
            date: '2025-01-02',
            timestamp: '2025-01-02T03:04:00.000Z'
        })
    })

    describe('직렬화할 값이 undefined이면', () => {
        let value: undefined
        beforeEach(() => {
            value = undefined
        })
        it('직렬화하면 빈 데이터를 만들고 복원하면 undefined를 반환한다', () => {
            const serialized = TemporalJsonSerde.serialize(value)

            expect(serialized).toHaveLength(0)
            expect(TemporalJsonSerde.deserialize(serialized)).toBeUndefined()
        })
    })
})

describe('defineWorkflow', () => {
    it('입력·결과·재시도 정책과 시도 취소 신호를 SDK에 연결한다', async () => {
        const signal = new AbortController().signal
        const retry = { initialRetryInterval: 100, maxRetryAttempts: 2, maxRetryDuration: 1000 }
        const runStep = vi.fn(async (_name, operation) => operation())
        const execute = vi.fn(async () => 'result')
        const defined = defineWorkflow({
            name: 'adapter-test',
            input: z.string(),
            run: async (context, input: string) => {
                expect(input).toBe('input')
                expect(context.attemptSignal()).toBe(signal)
                return context.run('step', execute, retry)
            },
            options: {
                abortTimeout: 100,
                inactivityTimeout: 1000,
                workflowRetention: 5000,
                terminalError: (error) =>
                    error instanceof Error && error.message === 'terminal'
                        ? { message: error.message, errorCode: 409 }
                        : undefined
            }
        }) as unknown as {
            name: string
            workflow: { run: (context: WorkflowContext, input: string) => Promise<string> }
            options: {
                asTerminalError: (error: unknown) => TerminalError | undefined
                serde: typeof TemporalJsonSerde
            }
        }
        const context = {
            run: runStep,
            request: () => ({ attemptCompletedSignal: signal })
        } as unknown as WorkflowContext
        await expect(defined.workflow.run(context, 'input')).resolves.toBe('result')
        expect(execute).toHaveBeenCalledOnce()
        expect(runStep).toHaveBeenCalledWith('step', execute, retry)
        expect(defined.options).toMatchObject({
            abortTimeout: 100,
            inactivityTimeout: 1000,
            workflowRetention: 5000,
            serde: TemporalJsonSerde
        })
        expect(defined.options.asTerminalError(new Error('temporary'))).toBeUndefined()
        expect(defined.options.asTerminalError(new Error('terminal'))).toMatchObject({
            message: 'terminal',
            code: 409
        })
    })

    describe('워크플로 정의에 오류 분류 함수가 없으면', () => {
        let definition: Parameters<typeof defineWorkflow>[0]
        beforeEach(() => {
            definition = {
                name: 'retrying-workflow',
                input: z.void(),
                run: async () => undefined,
                options: { abortTimeout: 100, inactivityTimeout: 1000, workflowRetention: 5000 }
            }
        })
        it('워크플로를 정의하면 asTerminalError를 설정하지 않는다', () => {
            const retrying = defineWorkflow(definition) as unknown as {
                options: { asTerminalError?: unknown }
            }
            expect(retrying.options.asTerminalError).toBeUndefined()
        })
    })
})

describe('isWorkflowCancellation', () => {
    describe.each([
        {
            condition: '워크플로 취소 오류가 발생했으면',
            error: new CancelledError(),
            expected: true
        },
        { condition: '일반 오류가 발생했으면', error: new Error('temporary'), expected: false }
    ])('$condition', ({ error, expected }) => {
        let failure: typeof error
        beforeEach(() => {
            failure = error
        })
        it(`취소 오류인지 판별하면 ${expected}를 반환한다`, () => {
            expect(isWorkflowCancellation(failure)).toBe(expected)
        })
    })
})
