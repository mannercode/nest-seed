import { z } from 'zod'
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

    describe('작업 제출이 접수되도록 설정하면', () => {
        let fix: ReturnType<typeof createFixture>
        beforeEach(() => {
            fix = createFixture({ result: vi.fn() })
        })
        it('지정한 키와 60초 제한으로 제출하고 완료 결과를 기다리지 않는다', async () => {
            await expect(fix.client.submit(input, input.sagaId)).resolves.toBe(submission)
            expect(fix.workflowClient).toHaveBeenCalledWith(fix.definition, input.sagaId)
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
            result = vi.fn().mockResolvedValue(terminal)
            fix = createFixture({ result })
        })
        it('완료를 기다리면 SDK의 결과 조회를 호출해 그 결과를 반환한다', async () => {
            await expect(fix.client.waitForCompletion(submission)).resolves.toEqual(terminal)

            expect(result).toHaveBeenCalledWith(submission)
        })
    })

    describe('완료 결과 조회가 실패하도록 설정하면', () => {
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

    describe('작업 제출이 실패하도록 설정하면', () => {
        let fix: ReturnType<typeof createFixture>
        beforeEach(() => {
            fix = createFixture({
                result: vi.fn(),
                workflowSubmit: vi.fn().mockRejectedValue(new Error('ingress unavailable'))
            })
        })
        it('제출 시 오류를 던지고 완료 결과는 조회하지 않는다', async () => {
            await expect(fix.client.submit(input, input.sagaId)).rejects.toThrow(
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
            await expect(fix.client.output(input.sagaId)).resolves.toEqual({ ready: false })
            expect(fix.workflowClient).toHaveBeenCalledWith(fix.definition, input.sagaId)
            expect(workflowOutput.mock.calls[0]?.[0].opts).toEqual({ timeout: 60_000 })
        })
    })

    describe('워크플로 출력이 준비되었으면', () => {
        let fix: ReturnType<typeof createFixture>
        beforeEach(() => {
            const workflowOutput = vi.fn().mockResolvedValue({ ready: true, result: terminal })
            fix = createFixture({ result: vi.fn(), workflowOutput })
        })
        it('출력을 조회하면 ready: true와 완료 결과를 반환한다', async () => {
            await expect(fix.client.output(input.sagaId)).resolves.toEqual({
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
                createdShowtimeCount: z.number(),
                createdTicketCount: z.number(),
                sagaId: z.string(),
                status: z.literal('succeeded')
            })
        )

        return { client, definition, result, workflowClient, workflowOutput, workflowSubmit }
    }
})
