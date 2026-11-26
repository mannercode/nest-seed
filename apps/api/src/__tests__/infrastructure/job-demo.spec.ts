import { TextJobSchema } from '#infrastructure'
import { JobDemoRepository } from '../../services/infrastructure/job-demo/job-demo.repository.js'
import { TextJobWorkflowClient } from '../../services/infrastructure/job-demo/worker.js'
import {
    createAppTestContext,
    createAndLoginUser,
    createUser,
    loginUser,
    trackRestateCompletions,
    type AppTestContext
} from '../helpers/index.js'

describe('임시 Restate 배포에서 작업의 결과 조회가 실패했으면', () => {
    const failure = new Error('Result endpoint unavailable')
    let waitForWorkflows: () => Promise<void>
    beforeEach(async () => {
        const client = {
            submit: async (_input: string, id: string) => id,
            waitForCompletion: vi.fn().mockRejectedValue(failure)
        }
        waitForWorkflows = trackRestateCompletions(client)
        await client.submit('value', 'job')
    })
    it('배포를 정리하기 전 완료를 확인하면 조회 오류를 전달한다', async () => {
        await expect(waitForWorkflows()).rejects.toMatchObject({ errors: [failure] })
    })
})

describe('JobDemoService', () => {
    let fix: AppTestContext
    let token: string
    beforeEach(async () => {
        fix = await createAppTestContext()
        token = (await createAndLoginUser(fix)).accessToken
    })
    afterEach(() => fix?.teardown())
    it('인증 없이 작업을 요청하면 401을 반환한다', async () => {
        await fix.httpClient.post('/job-demo/jobs').body({ text: 'hello' }).unauthorized()
    })
    describe('입력이 빈 문자열이면', () => {
        it('작업을 제출하면 400을 반환한다', async () => {
            await fix.httpClient
                .post('/job-demo/jobs')
                .headers({ Authorization: 'Bearer ' + token })
                .body({ text: '' })
                .badRequest()
        })
    })
    describe('Restate가 작업 접수를 거절하면', () => {
        beforeEach(() => {
            vi.spyOn(fix.module.get(TextJobWorkflowClient), 'submit').mockRejectedValueOnce(
                new Error('submission rejected')
            )
        })
        it('작업을 제출하면 500을 반환한다', async () => {
            await fix.httpClient
                .post('/job-demo/jobs')
                .headers({ Authorization: 'Bearer ' + token })
                .body({ text: 'hello' })
                .internalServerError()
        })
    })
    describe.each([
        { condition: '결과 저장이 가능하면', failure: false },
        { condition: '첫 결과 저장이 실패하면', failure: true }
    ])('$condition', ({ failure }) => {
        beforeEach(() => {
            if (failure)
                vi.spyOn(fix.module.get(JobDemoRepository), 'complete').mockRejectedValueOnce(
                    new Error('storage unavailable')
                )
        })
        it('작업을 접수하면 대문자 변환 결과를 저장하고 조회할 수 있다', async () => {
            const client = fix.module.get(TextJobWorkflowClient)
            const submit = vi.spyOn(client, 'submit')
            const { body } = await fix.httpClient
                .post('/job-demo/jobs')
                .headers({ Authorization: 'Bearer ' + token })
                .body({ text: 'Hello 🌱' })
                .accepted()
            const result = await client.waitForCompletion(await submit.mock.results[0]!.value)
            expect(result).toEqual({ text: 'HELLO 🌱', characterCount: 7 })
            await fix.httpClient
                .get('/job-demo/jobs/' + body.jobId)
                .headers({ Authorization: 'Bearer ' + token })
                .ok({
                    schema: TextJobSchema,
                    expected: { jobId: body.jobId, status: 'completed', result }
                })
        })
    })
    describe('결과 저장을 기다리는 작업이 있으면', () => {
        const started = () => Promise.withResolvers<void>()
        let entered: ReturnType<typeof started>
        let resume: ReturnType<typeof started>
        beforeEach(() => {
            entered = started()
            resume = started()
            const repository = fix.module.get(JobDemoRepository)
            const complete = repository.complete.bind(repository)
            vi.spyOn(repository, 'complete').mockImplementationOnce(async (...args) => {
                entered.resolve()
                await resume.promise
                await complete(...args)
            })
        })
        afterEach(() => resume.resolve())
        it('작업을 조회하면 pending을 반환한다', async () => {
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
        it('작업 조회에 404를 반환한다', async () => {
            await fix.httpClient
                .get('/job-demo/jobs/' + jobId)
                .headers({ Authorization: 'Bearer ' + otherToken })
                .notFound()
        })
    })
})
