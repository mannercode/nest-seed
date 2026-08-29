import type { WorkflowSubmission } from '@restatedev/restate-sdk-clients'
import { workflow } from '@restatedev/restate-sdk'
import type { AppConfigService } from '#config'
import type { ShowtimeCreationWorkflow } from '../workflow.js'
import { ShowtimeCreationWorkflowClient } from '../restate-workflow-client.service.js'

describe('ShowtimeCreationWorkflowClient', () => {
    const input = {
        createDto: {
            durationInMinutes: 90,
            movieId: 'movie-id',
            startTimes: [new Date('2100-01-01T09:00:00.000Z')],
            theaterIds: ['theater-id']
        },
        sagaId: 'saga-id'
    }
    const submission: WorkflowSubmission<void> = {
        attachable: true,
        invocationId: 'invocation-id',
        status: 'Accepted'
    }

    it('workflow key와 10초 attempt timeout으로 제출하되 완료를 암묵적으로 기다리지 않는다', async () => {
        const fix = createFixture({ result: jest.fn() })

        await expect(fix.client.submit(input, input.sagaId)).resolves.toBe(submission)
        expect(fix.workflowClient).toHaveBeenCalledWith(fix.definition, input.sagaId)
        expect(fix.workflowSubmit).toHaveBeenCalledTimes(1)
        expect(fix.workflowSubmit.mock.calls[0]?.[0]).toEqual(input)
        expect(fix.workflowSubmit.mock.calls[0]?.[1].opts).toEqual({ timeout: 10_000 })
        expect(fix.result).not.toHaveBeenCalled()
    })

    it('호출자가 요청할 때만 workflow 완료를 기다린다', async () => {
        const result = jest.fn().mockResolvedValue(undefined)
        const fix = createFixture({ result })

        await expect(fix.client.waitForCompletion(submission)).resolves.toBeUndefined()

        expect(result).toHaveBeenCalledWith(submission)
    })

    it('명시한 완료 대기의 실패는 호출자에게 전달한다', async () => {
        const fix = createFixture({
            result: jest.fn().mockRejectedValue(new Error('workflow failed'))
        })

        await expect(fix.client.waitForCompletion(submission)).rejects.toThrow('workflow failed')
    })

    it('제출 자체가 실패해도 완료 대기를 암묵적으로 시작하지 않는다', async () => {
        const fix = createFixture({
            result: jest.fn(),
            workflowSubmit: jest.fn().mockRejectedValue(new Error('ingress unavailable'))
        })

        await expect(fix.client.submit(input, input.sagaId)).rejects.toThrow('ingress unavailable')
        expect(fix.result).not.toHaveBeenCalled()
    })

    function createFixture({
        result,
        workflowSubmit = jest.fn().mockResolvedValue(submission)
    }: {
        result: jest.Mock
        workflowSubmit?: jest.Mock
    }) {
        const definition = workflow({
            handlers: { run: async () => undefined },
            name: 'WorkflowClientTest'
        })
        const workflowProvider = { definition } as ShowtimeCreationWorkflow
        const config = { restate: { ingressUrl: 'http://restate.test:8080' } } as AppConfigService
        const client = new ShowtimeCreationWorkflowClient(workflowProvider, config)
        const workflowClient = jest.fn(() => ({ workflowSubmit }))
        const ingress = { result, workflowClient }
        ;(client as unknown as { ingress: typeof ingress }).ingress = ingress

        return { client, definition, result, workflowClient, workflowSubmit }
    }
})
