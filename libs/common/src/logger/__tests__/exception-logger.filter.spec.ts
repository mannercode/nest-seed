import type { ArgumentsHost } from '@nestjs/common'
import { HttpExceptionLoggerFilter } from '../index.js'
import {
    type ExceptionLoggerFilterFixture,
    createExceptionLoggerFilterFixture
} from './exception-logger.filter.fixture.js'

describe('HttpExceptionLoggerFilter', () => {
    let fix: ExceptionLoggerFilterFixture

    beforeEach(async () => {
        fix = await createExceptionLoggerFilterFixture()
    })
    afterEach(() => fix.teardown())

    describe('HTTP 컨텍스트', () => {
        describe('내부 오류를 던지는 경로이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/internal-error')
            })
            it('요청하면 500을 반환하고 상세 원인은 로그에 남긴다', async () => {
                await request.internalServerError({
                    expected: {
                        statusCode: 500,
                        message: 'Internal server error',
                        error: 'Internal Server Error'
                    }
                })

                expect(fix.spyError).toHaveBeenCalledWith(
                    'error',
                    expect.objectContaining({
                        statusCode: 500,
                        error: {
                            name: 'InternalServerErrorException',
                            cause: 'Unexpected storage result'
                        }
                    })
                )
            })
        })

        describe('404 예외를 던지는 경로이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/exception')
            })
            it('요청하면 Logger.warn으로 로그를 남긴다', async () => {
                await request.notFound({ expected: { code: 'ERR_CODE', message: 'message' } })

                expect(fix.spyWarn).toHaveBeenCalledTimes(1)
                expect(fix.spyWarn).toHaveBeenCalledWith('fail', {
                    contextType: 'http',
                    duration: expect.any(String),
                    error: { code: 'ERR_CODE', name: 'NotFoundException' },
                    request: { method: 'GET', route: '/exception' },
                    stack: expect.any(Array),
                    statusCode: 404
                })
            })
        })

        describe('등록되지 않은 경로이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/missing-route')
            })
            it('요청하면 오류 로그에 실제 요청 경로를 기록한다', async () => {
                await request.notFound()

                expect(fix.spyWarn).toHaveBeenCalledWith(
                    'fail',
                    expect.objectContaining({ request: { method: 'GET', route: '/missing-route' } })
                )
            })
        })

        describe('401 예외를 던지는 경로이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/unauthorized')
            })
            it('요청하면 Logger.warn으로 로그를 남긴다', async () => {
                await request.unauthorized()

                expect(fix.spyWarn).toHaveBeenCalledWith(
                    'fail',
                    expect.objectContaining({ statusCode: 401 })
                )
            })
        })

        describe('422 예외를 던지는 경로이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/unprocessable')
            })
            it('요청하면 Logger.warn으로 로그를 남긴다', async () => {
                await request.unprocessableEntity()

                expect(fix.spyWarn).toHaveBeenCalledWith(
                    'fail',
                    expect.objectContaining({ statusCode: 422 })
                )
            })
        })

        describe('문자열 응답을 담은 HttpException을 던지는 경로이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/string-response')
            })
            it('요청하면 오류 이름과 상태 코드를 로그에 기록한다', async () => {
                await request.badRequest()

                expect(fix.spyWarn).toHaveBeenCalledWith(
                    'fail',
                    expect.objectContaining({ error: { name: 'HttpException' }, statusCode: 400 })
                )
            })
        })

        it('요청 본문과 query를 오류 로그에 포함하지 않는다', async () => {
            await fix.httpClient
                .post('/exception?token=query-secret')
                .body({ password: 'request-secret' })
                .notFound()

            const log = fix.spyWarn.mock.calls[0]?.[1]
            expect(log).not.toHaveProperty('response')
            expect(log.request).toEqual({ method: 'POST', route: '/exception' })
            expect(JSON.stringify(log)).not.toContain('request-secret')
            expect(JSON.stringify(log)).not.toContain('query-secret')
        })

        it('duration을 인터셉터가 기록한 요청 시작 시각부터 계산한다', async () => {
            await fix.httpClient.get('/slow-exception').notFound()

            expect(fix.spyWarn).toHaveBeenCalledTimes(1)
            const firstCall = fix.spyWarn.mock.calls[0]
            if (!firstCall) throw new Error('Logger.warn must be called')
            const [, log] = firstCall
            // 핸들러는 50ms 기다린 뒤 예외를 던진다. 요청 시작 시각을 기록하지 않으면 duration이 0ms가 된다.
            // 부하가 있으면 시간이 더 길어질 수 있으므로, 타이머 오차를 감안한 최소 시간만 확인한다.
            expect(parseInt(log.duration)).toBeGreaterThanOrEqual(40)
        })

        describe('일반 Error를 던지는 경로이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/error')
            })
            it('요청하면 Logger.error로 로그를 남긴다', async () => {
                await request.internalServerError()

                expect(fix.spyError).toHaveBeenCalledTimes(1)
                expect(fix.spyError).toHaveBeenCalledWith('error', {
                    contextType: 'http',
                    duration: expect.any(String),
                    error: { name: 'Error' },
                    request: { method: 'GET', route: '/error' },
                    stack: expect.any(Array),
                    statusCode: 500
                })
            })
        })

        describe('Error 대신 문자열을 던지는 경로이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/throw-string')
            })
            it('요청해도 예외 필터가 로그를 남기지 않는다', async () => {
                await request.internalServerError()

                expect(fix.spyError).not.toHaveBeenCalledWith('error', expect.anything())
                expect(fix.spyWarn).not.toHaveBeenCalledWith('fail', expect.anything())
            })
        })
    })

    describe('컨텍스트 유형이 RPC이면', () => {
        let filter: HttpExceptionLoggerFilter
        let fakeHost: ArgumentsHost

        beforeEach(async () => {
            filter = new HttpExceptionLoggerFilter()
            fakeHost = {
                getType: () => 'rpc',
                getArgs: () => [],
                getArgByIndex: () => undefined,
                switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
                switchToRpc: () => ({}),
                switchToWs: () => ({})
            } as any
        })

        it('예외를 처리하면 지원하지 않는 컨텍스트 유형을 Logger.error로 남긴다', () => {
            try {
                filter.catch(new Error('boom'), fakeHost)
            } catch {
                // super.catch가 예외를 던질 수 있지만 이 단언과는 무관하다.
            }

            expect(fix.spyError).toHaveBeenCalledWith(
                'HttpExceptionLoggerFilter: unknown context type',
                expect.objectContaining({ contextType: 'rpc' })
            )
        })
    })

    describe('HttpSuccessLoggerInterceptor가 등록되지 않았을 때', () => {
        let solo: ExceptionLoggerFilterFixture

        beforeEach(async () => {
            solo = await createExceptionLoggerFilterFixture({ withInterceptor: false })
        })
        afterEach(() => solo.teardown())

        it('markRequestStart가 호출되지 않은 요청도 duration을 산출해 로그를 남긴다', async () => {
            await solo.httpClient.get('/exception').notFound()

            expect(solo.spyWarn).toHaveBeenCalledWith(
                'fail',
                expect.objectContaining({ duration: expect.stringMatching(/^\d+ms$/) })
            )
        })
    })
})
