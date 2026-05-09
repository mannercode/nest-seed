import type { ExceptionLoggerFilterFixture } from './exception-logger.filter.fixture'

describe('HttpExceptionLoggerFilter', () => {
    let fix: ExceptionLoggerFilterFixture

    beforeEach(async () => {
        const { createExceptionLoggerFilterFixture } =
            await import('./exception-logger.filter.fixture')
        fix = await createExceptionLoggerFilterFixture()
    })
    afterEach(() => fix.teardown())

    describe('HTTP context', () => {
        describe('HttpException이 발생할 때', () => {
            it('Logger.warn으로 로그를 남긴다', async () => {
                await fix.httpClient
                    .get('/exception')
                    .notFound({ code: 'ERR_CODE', message: 'message' })

                expect(fix.spyWarn).toHaveBeenCalledTimes(1)
                expect(fix.spyWarn).toHaveBeenCalledWith('fail', {
                    contextType: 'http',
                    duration: expect.any(String),
                    request: { method: 'GET', url: '/exception' },
                    response: { code: 'ERR_CODE', message: 'message' },
                    stack: expect.any(Array),
                    statusCode: 404
                })
            })
        })

        describe('요청 body에 민감 필드가 있을 때', () => {
            it('body의 password를 [REDACTED]로 마스킹한다', async () => {
                await fix.httpClient
                    .post('/exception')
                    .body({ email: 'a@b.com', password: 'secret' })
                    .notFound()

                expect(fix.spyWarn).toHaveBeenCalledWith(
                    'fail',
                    expect.objectContaining({
                        request: expect.objectContaining({
                            body: { email: 'a@b.com', password: '[REDACTED]' }
                        })
                    })
                )
            })
        })

        describe('일반 Error가 발생할 때', () => {
            it('Logger.error로 로그를 남긴다', async () => {
                await fix.httpClient.get('/error').internalServerError()

                expect(fix.spyError).toHaveBeenCalledTimes(1)
                expect(fix.spyError).toHaveBeenCalledWith('error', {
                    contextType: 'http',
                    duration: expect.any(String),
                    request: { method: 'GET', url: '/error' },
                    response: { message: 'error message' },
                    stack: expect.any(Array),
                    statusCode: 500
                })
            })
        })
    })

    // success interceptor 없이 filter 단독으로 등록된 경우 (request._startTimestamp 미설정)
    describe('without HttpSuccessLoggerInterceptor', () => {
        let solo: ExceptionLoggerFilterFixture

        beforeEach(async () => {
            const { createExceptionLoggerFilterFixture } =
                await import('./exception-logger.filter.fixture')
            solo = await createExceptionLoggerFilterFixture({ withInterceptor: false })
        })
        afterEach(() => solo.teardown())

        it('_startTimestamp 가 없어도 duration 을 산출해 로그를 남긴다', async () => {
            await solo.httpClient.get('/exception').notFound()

            expect(solo.spyWarn).toHaveBeenCalledWith(
                'fail',
                expect.objectContaining({ duration: expect.stringMatching(/^\d+ms$/) })
            )
        })
    })
})
