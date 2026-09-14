import type { WorkflowSubmission } from '@restatedev/restate-sdk-clients'
import type * as RestateClients from '@restatedev/restate-sdk-clients'
import type { Mock } from 'vitest'
import { instant } from '@mannercode/testing'
import { workflow } from '@restatedev/restate-sdk'
import { RestateWorkflowClient, TemporalJsonSerde } from '../index.js'

type TestResult = {
    createdShowtimeCount: number
    createdTicketCount: number
    sagaId: string
    status: 'succeeded'
}

const restateMocks = vi.hoisted(() => ({ connect: vi.fn() }))

vi.mock('@restatedev/restate-sdk-clients', async (importOriginal) => {
    const original = await importOriginal<typeof RestateClients>()
    return { ...original, connect: restateMocks.connect }
})

describe('RestateWorkflowClient', () => {
    const terminal: TestResult = {
        createdShowtimeCount: 1,
        createdTicketCount: 10,
        sagaId: 'saga-id',
        status: 'succeeded'
    }
    const input = {
        createDto: {
            durationInMinutes: 90,
            movieId: 'movie-id',
            startTimes: [instant('2100-01-01T09:00:00.000Z')],
            theaterIds: ['theater-id']
        },
        sagaId: 'saga-id'
    }
    const submission: WorkflowSubmission<TestResult> = {
        attachable: true,
        invocationId: 'invocation-id',
        status: 'Accepted'
    }

    it('workflow key와 10초 attempt timeout으로 제출하되 완료를 암묵적으로 기다리지 않는다', async () => {
        const fix = createFixture({ result: vi.fn() })

        await expect(fix.client.submit(input, input.sagaId)).resolves.toBe(submission)
        expect(fix.workflowClient).toHaveBeenCalledWith(fix.definition, input.sagaId)
        expect(fix.workflowSubmit).toHaveBeenCalledTimes(1)
        expect(fix.workflowSubmit.mock.calls[0]?.[0]).toEqual(input)
        expect(fix.workflowSubmit.mock.calls[0]?.[1].opts).toEqual({ timeout: 10_000 })
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

    it('호출자가 요청할 때만 workflow 완료를 기다린다', async () => {
        const result = vi.fn().mockResolvedValue(terminal)
        const fix = createFixture({ result })

        await expect(fix.client.waitForCompletion(submission)).resolves.toEqual(terminal)

        expect(result).toHaveBeenCalledWith(submission)
    })

    it('명시한 완료 대기의 실패는 호출자에게 전달한다', async () => {
        const fix = createFixture({
            result: vi.fn().mockRejectedValue(new Error('workflow failed'))
        })

        await expect(fix.client.waitForCompletion(submission)).rejects.toThrow('workflow failed')
    })

    it('제출 자체가 실패해도 완료 대기를 암묵적으로 시작하지 않는다', async () => {
        const fix = createFixture({
            result: vi.fn(),
            workflowSubmit: vi.fn().mockRejectedValue(new Error('ingress unavailable'))
        })

        await expect(fix.client.submit(input, input.sagaId)).rejects.toThrow('ingress unavailable')
        expect(fix.result).not.toHaveBeenCalled()
    })

    it('workflow 출력 준비 여부를 반환한다', async () => {
        const workflowOutput = vi.fn().mockResolvedValue({ ready: false })
        const fix = createFixture({ result: vi.fn(), workflowOutput })

        await expect(fix.client.output(input.sagaId)).resolves.toEqual({ ready: false })
        expect(fix.workflowClient).toHaveBeenCalledWith(fix.definition, input.sagaId)
        expect(workflowOutput.mock.calls[0]?.[0].opts).toEqual({ timeout: 10_000 })
    })

    it('workflow 출력이 준비됐으면 결과를 반환한다', async () => {
        const workflowOutput = vi.fn().mockResolvedValue({ ready: true, result: terminal })
        const fix = createFixture({ result: vi.fn(), workflowOutput })

        await expect(fix.client.output(input.sagaId)).resolves.toEqual({
            ready: true,
            result: terminal
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
            'http://restate.test:8080'
        )

        return { client, definition, result, workflowClient, workflowOutput, workflowSubmit }
    }
})
