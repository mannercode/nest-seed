import { CancelledError, TerminalError, type WorkflowContext } from '@restatedev/restate-sdk'
import { instant, plainDate } from '@mannercode/testing'
import { TemporalJsonSerde, defineWorkflow, isWorkflowCancellation } from '../index.js'

describe('TemporalJsonSerde', () => {
    it('Restate wire와 journal에서 Instant와 PlainDate를 원래 의미로 왕복한다', () => {
        const value = { date: plainDate('2025-01-02'), timestamp: instant('2025-01-02T03:04:00Z') }

        const serialized = TemporalJsonSerde.serialize(value)

        expect(new TextDecoder().decode(serialized)).toBe(
            '{"date":"2025-01-02","timestamp":"2025-01-02T03:04:00.000Z"}'
        )
        expect(TemporalJsonSerde.deserialize(serialized)).toEqual(value)
    })

    it('void handler와 ctx.run 결과는 빈 payload로 왕복한다', () => {
        const serialized = TemporalJsonSerde.serialize(undefined)

        expect(serialized).toHaveLength(0)
        expect(TemporalJsonSerde.deserialize(serialized)).toBeUndefined()
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

        const retrying = defineWorkflow({
            name: 'retrying-workflow',
            run: execute,
            options: { abortTimeout: 100, inactivityTimeout: 1000, workflowRetention: 5000 }
        }) as unknown as { options: { asTerminalError?: unknown } }
        expect(retrying.options.asTerminalError).toBeUndefined()
    })

    it('워크플로 취소 오류만 취소로 분류한다', () => {
        expect(isWorkflowCancellation(new CancelledError())).toBe(true)
        expect(isWorkflowCancellation(new Error('temporary'))).toBe(false)
    })
})
