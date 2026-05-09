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

            it.todo('4xx (401, 422) HttpException 도 4xx 카테고리로 redact 후 로깅한다')
            it.todo('HttpException.getResponse() 가 string 인 경우에도 redact 가 안전하게 통과한다')
        })

        describe('요청 body에 민감 필드가 있을 때', () => {
            // 본 redaction 의 본격 검증은 redact.spec.ts 에서. 여기서는 filter 가 redact 를 호출했는지만 확인.
            it('body의 password를 [REDACTED]로 마스킹한다', async () => {
                await fix.httpClient
                    .post('/exception')
                    .body({ password: 'secret' })
                    .notFound()

                expect(fix.spyWarn).toHaveBeenCalledWith(
                    'fail',
                    expect.objectContaining({
                        request: expect.objectContaining({
                            body: expect.objectContaining({ password: '[REDACTED]' })
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

            it.todo(
                '@Catch(Error) 가 Error 인스턴스가 아닌 throw (예: throw "oops" / throw 42) 는 catch 하지 않는다 (필터 매칭 한계 lock-down)'
            )
        })

        it.todo(
            'contextType 이 http 가 아니면 (예: rpc) Logger.error 에 unknown context type 메시지를 남긴다'
        )
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
