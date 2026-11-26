import { z } from 'zod'
import type { WorkflowSubmission } from '@restatedev/restate-sdk-clients'
import type * as RestateClients from '@restatedev/restate-sdk-clients'
import type { Mock } from 'vitest'
import { instant } from '@mannercode/testing'
import { workflow } from '@restatedev/restate-sdk'
import { RestateWorkflowClient, TemporalJsonSerde } from '#common/restate'
import { InstantFromInputSchema } from '#common/utils'

type TestResult = {
    completedAt: Temporal.Instant
    processedCount: number
    status: 'succeeded'
    workflowId: string
}

const restateMocks = vi.hoisted(() => ({ connect: vi.fn() }))

vi.mock('@restatedev/restate-sdk-clients', async (importOriginal) => {
    const original = await importOriginal<typeof RestateClients>()
    return { ...original, connect: restateMocks.connect }
})

describe('RestateWorkflowClient', () => {
    const terminal: TestResult = {
        completedAt: instant('2100-01-01T10:00:00Z'),
        processedCount: 1,
        status: 'succeeded',
        workflowId: 'workflow-id'
    }
    const storedResult = TemporalJsonSerde.deserialize(TemporalJsonSerde.serialize(terminal))
    const input = {
        payload: {
            count: 1,
            message: 'test message',
            tags: ['sample'],
            timestamps: [instant('2100-01-01T09:00:00.000Z')]
        },
        workflowId: 'workflow-id'
    }
    const submission: WorkflowSubmission<TestResult> = {
        attachable: true,
        invocationId: 'invocation-id',
        status: 'Accepted'
    }

    describe('서버가 작업 제출을 접수하면', () => {
        let fix: ReturnType<typeof createFixture>
        beforeEach(() => {
            fix = createFixture({ result: vi.fn() })
        })
        it('지정한 키와 60초 제한으로 제출하고 완료 결과를 기다리지 않는다', async () => {
            await expect(fix.client.submit(input, input.workflowId)).resolves.toBe(submission)
            expect(fix.workflowClient).toHaveBeenCalledWith(fix.definition, input.workflowId)
            expect(fix.workflowSubmit).toHaveBeenCalledTimes(1)
            expect(fix.workflowSubmit.mock.calls[0]?.[0]).toEqual(input)
            expect(fix.workflowSubmit.mock.calls[0]?.[1].opts).toEqual({ timeout: 60_000 })
            expect(fix.result).not.toHaveBeenCalled()
            expect(restateMocks.connect).toHaveBeenCalledWith({
                retry: {
                    initialInterval: 250,
                    maxAttempts: 6,
                    maxDuration: 60_000,
                    maxInterval: 3_000
                },
                serde: TemporalJsonSerde,
                url: 'http://restate.test:8080'
            })
        })
    })

    describe('완료 결과가 준비되어 있으면', () => {
        let fix: ReturnType<typeof createFixture>
        let result: Mock
        beforeEach(() => {
            result = vi.fn().mockResolvedValue(storedResult)
            fix = createFixture({ result })
        })
        it('완료를 기다리면 제출한 작업을 조회하고 완료 시각을 Instant로 복원해 반환한다', async () => {
            await expect(fix.client.waitForCompletion(submission)).resolves.toEqual(terminal)

            expect(result).toHaveBeenCalledWith(submission)
        })
    })

    describe('완료 결과 조회가 실패하면', () => {
        let fix: ReturnType<typeof createFixture>
        beforeEach(() => {
            fix = createFixture({ result: vi.fn().mockRejectedValue(new Error('workflow failed')) })
        })
        it('완료를 기다리면 조회 오류를 던진다', async () => {
            await expect(fix.client.waitForCompletion(submission)).rejects.toThrow(
                'workflow failed'
            )
        })
    })

    describe('작업 제출이 실패하면', () => {
        let fix: ReturnType<typeof createFixture>
        beforeEach(() => {
            fix = createFixture({
                result: vi.fn(),
                workflowSubmit: vi.fn().mockRejectedValue(new Error('ingress unavailable'))
            })
        })
        it('오류를 던지고 완료 결과는 조회하지 않는다', async () => {
            await expect(fix.client.submit(input, input.workflowId)).rejects.toThrow(
                'ingress unavailable'
            )
            expect(fix.result).not.toHaveBeenCalled()
        })
    })

    describe('워크플로 출력이 준비되지 않았으면', () => {
        let fix: ReturnType<typeof createFixture>
        let workflowOutput: Mock
        beforeEach(() => {
            workflowOutput = vi.fn().mockResolvedValue({ ready: false })
            fix = createFixture({ result: vi.fn(), workflowOutput })
        })
        it('출력을 조회하면 지정한 키와 60초 제한을 사용하고 ready: false를 반환한다', async () => {
            await expect(fix.client.output(input.workflowId)).resolves.toEqual({ ready: false })
            expect(fix.workflowClient).toHaveBeenCalledWith(fix.definition, input.workflowId)
            expect(workflowOutput.mock.calls[0]?.[0].opts).toEqual({ timeout: 60_000 })
        })
    })

    describe('워크플로 출력이 준비되었으면', () => {
        let fix: ReturnType<typeof createFixture>
        beforeEach(() => {
            const workflowOutput = vi.fn().mockResolvedValue({ ready: true, result: storedResult })
            fix = createFixture({ result: vi.fn(), workflowOutput })
        })
        it('출력을 조회하면 완료 시각을 Instant로 복원한 결과와 ready: true를 반환한다', async () => {
            await expect(fix.client.output(input.workflowId)).resolves.toEqual({
                ready: true,
                result: terminal
            })
        })
    })

    function createFixture({
        result,
        workflowOutput = vi.fn(),
        workflowSubmit = vi.fn().mockResolvedValue(submission)
    }: {
        result: Mock
        workflowOutput?: Mock
        workflowSubmit?: Mock
    }) {
        const definition = workflow({
            handlers: { run: async () => terminal },
            name: 'WorkflowClientTest'
        })
        const workflowClient = vi.fn(() => ({ workflowOutput, workflowSubmit }))
        const ingress = { result, workflowClient }
        restateMocks.connect.mockReset()
        restateMocks.connect.mockReturnValue(ingress)
        const client = new RestateWorkflowClient<typeof input, TestResult>(
            definition,
            'http://restate.test:8080',
            z.object({
                completedAt: InstantFromInputSchema,
                processedCount: z.number(),
                status: z.literal('succeeded'),
                workflowId: z.string()
            })
        )

        return { client, definition, result, workflowClient, workflowOutput, workflowSubmit }
    }
})
