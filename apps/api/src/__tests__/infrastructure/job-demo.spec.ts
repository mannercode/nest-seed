import { RestateWorkflowClient, TemporalJsonSerde } from '@mannercode/common'
import type { INestApplication } from '@nestjs/common'
import { connect, HttpCallError } from '@restatedev/restate-sdk-clients'
import { Collection } from 'mongodb'
import { z } from 'zod'
import { AppConfigService } from '#config'
import {
    JobDemoService,
    TextJobInputSchema,
    TextJobResultSchema,
    TextJobSchema,
    TextJobWorkflow
} from '#infrastructure'
import {
    createAppTestContext,
    createAndLoginUser,
    createUser,
    loginUser,
    unregisterRestateDeployment,
    type AppTestContext
} from '#test-helpers'

describe('작업을 제출할 수 없는 테스트 앱에서', () => {
    let fix: AppTestContext
    beforeEach(async () => {
        fix = await createAppTestContext({
            overrideProviders: [{ original: JobDemoService, replacement: {} }]
        })
    })
    afterEach(() => fix?.teardown())

    it('GET /health는 200을 반환한다', async () => {
        const { body } = await fix.httpClient.get('/health').ok()
        expect(body.status).toBe('ok')
    })
})

describe('임시 Restate 배포 정리', () => {
    const failure = new HttpCallError(404, 'workflow not found', 'result unavailable')
    let waitForWorkflows: () => Promise<void>
    beforeEach(async () => {
        const jobs = { submit: vi.fn().mockResolvedValue({ jobId: 'job' }) }
        waitForWorkflows = trackRestateCompletions(jobs, vi.fn().mockRejectedValue(failure))
        await jobs.submit('user', { text: 'value' })
    })
    it('작업 완료를 확인할 수 없으면 조회 오류를 전달한다', async () => {
        await expect(waitForWorkflows()).rejects.toMatchObject({ errors: [failure] })
    })
})

describe('JobDemoService', () => {
    let fix: AppTestContext
    let token: string
    let jobs: ReturnType<typeof trackJobResults>
    beforeEach(async () => {
        fix = await createAppTestContext({
            configureApp: async (app) => {
                jobs = trackJobResults(app)
            },
            beforeDeploymentRemoval: () => jobs.waitForWorkflows()
        })
        token = (await createAndLoginUser(fix)).accessToken
    })
    afterEach(() => fix?.teardown())
    describe('인증 없이 작업을 요청하면', () => {
        it('401을 반환한다', async () => {
            await fix.httpClient.post('/job-demo/jobs').body({ text: 'hello' }).unauthorized()
        })
    })
    describe('빈 문자열로 작업을 제출하면', () => {
        it('400을 반환한다', async () => {
            await fix.httpClient
                .post('/job-demo/jobs')
                .headers({ Authorization: 'Bearer ' + token })
                .body({ text: '' })
                .badRequest()
        })
    })
    describe('Restate에 등록되지 않은 워크플로로 작업을 제출하면', () => {
        beforeEach(() => {
            const { definition } = fix.app.get(TextJobWorkflow)
            const missing = { name: 'Unregistered-' + definition.name }
            const ingress = connect({ url: fix.app.get(AppConfigService).restate.ingressUrl })
            vi.spyOn(RestateWorkflowClient.prototype, 'submit').mockImplementationOnce(
                (input, jobId) =>
                    ingress
                        .workflowClient<typeof definition>(missing, jobId)
                        .workflowSubmit(TextJobInputSchema.parse(input))
            )
        })
        it('500을 반환하고 앱 종료 시 임시 배포를 삭제한다', async () => {
            await fix.httpClient
                .post('/job-demo/jobs')
                .headers({ Authorization: 'Bearer ' + token })
                .body({ text: 'hello' })
                .internalServerError()
            await fix.teardown()
            expect((await fetch(fix.deploymentUrl)).status).toBe(404)
        })
    })
    describe('작업의 접수 응답을 받지 못하면', () => {
        const failure = new Error('submission response lost')
        beforeEach(() => {
            vi.spyOn(RestateWorkflowClient.prototype, 'submit').mockRejectedValueOnce(failure)
        })
        // 이 테스트는 전송 전에 실패를 주입했으므로 남겨 둔 배포를 지울 수 있다.
        afterEach(() => unregisterRestateDeployment(fix.deploymentUrl))
        it('500을 반환하고 앱 종료 시 배포를 보존하며 접수 오류를 전달한다', async () => {
            await fix.httpClient
                .post('/job-demo/jobs')
                .headers({ Authorization: 'Bearer ' + token })
                .body({ text: 'hello' })
                .internalServerError()
            await expect(fix.teardown()).rejects.toMatchObject({ errors: [failure] })
            expect((await fetch(fix.deploymentUrl)).status).toBe(200)
        })
    })
    async function submitTextJob() {
        const { body } = await fix.httpClient
            .post('/job-demo/jobs')
            .headers({ Authorization: 'Bearer ' + token })
            .body({ text: 'Hello 🌱' })
            .accepted({ schema: z.object({ jobId: z.string() }) })
        return body.jobId
    }

    async function expectCompletedJob(jobId: string) {
        const result = await jobs.waitForJob(jobId)
        expect(result).toEqual({ text: 'HELLO 🌱', characterCount: 7 })
        await fix.httpClient
            .get('/job-demo/jobs/' + jobId)
            .headers({ Authorization: 'Bearer ' + token })
            .ok({ schema: TextJobSchema, expected: { jobId, status: 'completed', result } })
    }

    describe('텍스트 작업을 제출하면', () => {
        it('대문자로 변환한 결과를 조회할 수 있다', async () => {
            const jobId = await submitTextJob()
            await expectCompletedJob(jobId)
        })
    })
    describe('첫 결과 저장이 실패하면', () => {
        let writeFailure: Promise<void>
        beforeEach(() => {
            const failed = Promise.withResolvers<void>()
            writeFailure = failed.promise
            vi.spyOn(Collection.prototype, 'updateOne').mockImplementationOnce(async () => {
                failed.resolve()
                throw new Error('storage unavailable')
            })
        })
        it('재시도 후 같은 작업의 결과를 조회할 수 있다', async () => {
            const jobId = await submitTextJob()
            await writeFailure
            await expectCompletedJob(jobId)
        })
    })
    describe('작업 결과를 저장하기 전에', () => {
        const started = () => Promise.withResolvers<void>()
        let entered: ReturnType<typeof started>
        let resume: ReturnType<typeof started>
        beforeEach(() => {
            entered = started()
            resume = started()
            const updateOne = Collection.prototype.updateOne
            vi.spyOn(Collection.prototype, 'updateOne').mockImplementationOnce(async function (
                this: Collection,
                ...args
            ) {
                entered.resolve()
                await resume.promise
                return updateOne.apply(this, args)
            })
        })
        afterEach(() => resume.resolve())
        it('조회하면 pending을 반환한다', async () => {
            try {
                const { body } = await fix.httpClient
                    .post('/job-demo/jobs')
                    .headers({ Authorization: 'Bearer ' + token })
                    .body({ text: 'waiting' })
                    .accepted()
                await entered.promise
                await fix.httpClient
                    .get('/job-demo/jobs/' + body.jobId)
                    .headers({ Authorization: 'Bearer ' + token })
                    .ok({
                        schema: TextJobSchema,
                        expected: { jobId: body.jobId, status: 'pending' }
                    })
            } finally {
                resume.resolve()
            }
        })
    })
    describe('다른 사용자가 접수한 작업이면', () => {
        let jobId: string
        let otherToken: string
        beforeEach(async () => {
            const { body } = await fix.httpClient
                .post('/job-demo/jobs')
                .headers({ Authorization: 'Bearer ' + token })
                .body({ text: 'private' })
                .accepted()
            jobId = body.jobId
            const user = await createUser(fix, { email: 'other@mail.com' })
            otherToken = (
                await loginUser(fix, { email: user.email, password: 'Example password 1!' })
            ).accessToken
        })
        it('조회하면 404를 반환한다', async () => {
            await fix.httpClient
                .get('/job-demo/jobs/' + jobId)
                .headers({ Authorization: 'Bearer ' + otherToken })
                .notFound()
        })
    })
})

function trackJobResults(app: INestApplication) {
    const { restate } = app.get(AppConfigService)
    const ingress = connect({ url: restate.ingressUrl, retry: true, serde: TemporalJsonSerde })
    const { definition } = app.get(TextJobWorkflow)
    const waitForJob = async (jobId: string) =>
        TextJobResultSchema.parse(
            await ingress.workflowClient<typeof definition>(definition, jobId).workflowAttach()
        )
    const waitForWorkflows = trackRestateCompletions(app.get(JobDemoService), waitForJob)
    return { waitForJob, waitForWorkflows }
}

function trackRestateCompletions(
    jobs: Pick<JobDemoService, 'submit'>,
    waitForJob: (jobId: string) => Promise<unknown>
) {
    const completions = new Set<Promise<unknown>>()
    const failures: unknown[] = []
    const submit = jobs.submit.bind(jobs)
    jobs.submit = (...args) => {
        const submission = submit(...args)
        const completion = submission
            .then(
                ({ jobId }) => waitForJob(jobId),
                (error: unknown) => {
                    // 제출 시 404는 Restate에 대상이 없어 기다릴 작업도 없다는 응답이다.
                    if (!(error instanceof HttpCallError && error.status === 404)) throw error
                }
            )
            .catch((error: unknown) => failures.push(error))
            .finally(() => completions.delete(completion))
        completions.add(completion)
        return submission
    }
    return async () => {
        while (completions.size > 0) await Promise.all(completions)
        if (failures.length)
            throw new AggregateError(failures, 'Could not confirm Restate workflow completion')
    }
}
