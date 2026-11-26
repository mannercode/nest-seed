import { RestateWorkflowClient } from '@mannercode/common'
import { Collection } from 'mongodb'
import { TextJobSchema } from '#infrastructure'
import {
    createAppTestContext,
    createAndLoginUser,
    createUser,
    loginUser,
    trackRestateCompletions,
    unregisterRestateDeployment,
    type AppTestContext
} from '#test-helpers'

describe('임시 Restate 배포 정리', () => {
    const failure = new Error('Result endpoint unavailable')
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
    beforeEach(async () => {
        fix = await createAppTestContext()
        token = (await createAndLoginUser(fix)).accessToken
    })
    afterEach(() => fix?.teardown())
    it('인증 없이 작업을 요청하면 401을 반환한다', async () => {
        await fix.httpClient.post('/job-demo/jobs').body({ text: 'hello' }).unauthorized()
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
    describe('Restate가 작업 제출을 거절하면', () => {
        const failure = new Error('submission rejected')
        beforeEach(() => {
            vi.spyOn(RestateWorkflowClient.prototype, 'submit').mockRejectedValueOnce(failure)
        })
        afterEach(() => unregisterRestateDeployment(fix.deploymentUrl))
        it('500을 반환하고 앱 종료 시 접수 오류를 전달한다', async () => {
            await fix.httpClient
                .post('/job-demo/jobs')
                .headers({ Authorization: 'Bearer ' + token })
                .body({ text: 'hello' })
                .internalServerError()
            await expect(fix.teardown()).rejects.toMatchObject({ errors: [failure] })
        })
    })
    describe.each([
        { condition: '결과 저장이 가능하면', failure: false },
        { condition: '첫 결과 저장이 실패하면', failure: true }
    ])('$condition', ({ failure }) => {
        let writeFailure: Promise<void>
        beforeEach(() => {
            if (failure) {
                const rejected = Promise.withResolvers<void>()
                writeFailure = rejected.promise
                vi.spyOn(Collection.prototype, 'updateOne').mockImplementationOnce(async () => {
                    rejected.resolve()
                    throw new Error('storage unavailable')
                })
            }
        })
        it('작업을 접수하면 대문자 변환 결과를 저장하고 조회할 수 있다', async () => {
            const { body } = await fix.httpClient
                .post('/job-demo/jobs')
                .headers({ Authorization: 'Bearer ' + token })
                .body({ text: 'Hello 🌱' })
                .accepted()
            if (failure) await writeFailure
            const result = await fix.waitForJob(body.jobId)
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
