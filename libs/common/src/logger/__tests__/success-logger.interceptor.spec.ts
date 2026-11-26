import { Logger } from '@nestjs/common'
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js'
import { lastValueFrom, of } from 'rxjs'
import { HttpSuccessLoggerInterceptor } from '#common/logger'
import {
    type SuccessLoggerInterceptorFixture,
    createSuccessLoggerInterceptorFixture
} from './success-logger.interceptor.fixture.js'

describe('HttpSuccessLoggerInterceptor가 RPC 경로에 등록됐으면', () => {
    let context: ExecutionContextHost
    const spyError = () => vi.spyOn(Logger, 'error')
    let logger: ReturnType<typeof spyError>
    beforeEach(() => {
        context = new ExecutionContextHost([])
        context.setType('rpc')
        logger = spyError().mockImplementation(() => undefined)
    })
    it('호출 결과를 전달하고 완료 시 잘못된 등록을 기록한다', async () => {
        const interceptor = new HttpSuccessLoggerInterceptor(undefined)
        const stream = await interceptor.intercept(context, { handle: () => of('done') })
        expect(await lastValueFrom(stream)).toBe('done')
        expect(logger).toHaveBeenCalledWith('HttpSuccessLoggerInterceptor: unknown context type', {
            contextType: 'rpc'
        })
    })
})

describe('HttpSuccessLoggerInterceptor', () => {
    let fix: SuccessLoggerInterceptorFixture

    afterEach(() => fix.teardown())

    describe('로그 제외 경로가 없는 상태에서', () => {
        beforeEach(async () => {
            fix = await createSuccessLoggerInterceptorFixture([])
        })

        it('성공한 요청은 verbose 수준으로 기록한다', async () => {
            await fix.httpClient
                .post('/success?token=query-secret')
                .body({ password: 'request-secret' })
                .created({ expected: { result: 'success' } })

            expect(fix.spyVerbose).toHaveBeenCalledTimes(1)
            expect(fix.spyVerbose).toHaveBeenCalledWith('success', {
                contextType: 'http',
                duration: expect.any(String),
                request: { method: 'POST', route: '/success' },
                statusCode: 201
            })
        })

        it('성공 로그에 요청·응답 본문을 포함하지 않는다', async () => {
            await fix.httpClient
                .post('/success')
                .body({ password: 'request-secret' })
                .created({ expected: { result: 'success' } })

            const log = fix.spyVerbose.mock.calls[0]?.[1]
            expect(log).not.toHaveProperty('response')
            expect(log.request).not.toHaveProperty('body')
            expect(JSON.stringify(log)).not.toContain('request-secret')
        })

        describe('요청이 실패하면', () => {
            it('성공 로그를 남기지 않는다', async () => {
                await fix.httpClient.get('/failure').internalServerError()

                expect(fix.spyVerbose).not.toHaveBeenCalled()
            })
        })
    })

    describe('LOGGING_EXCLUDE_HTTP_PATHS', () => {
        describe('제외 경로를 지정한 뒤', () => {
            beforeEach(async () => {
                fix = await createSuccessLoggerInterceptorFixture([
                    { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: ['/exclude-path'] }
                ])
            })

            it('해당 경로의 요청은 기록하지 않는다', async () => {
                await fix.httpClient.get('/exclude-path').ok({ expected: { result: 'success' } })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
            })

            it('하위 경로의 요청은 기록한다', async () => {
                await fix.httpClient
                    .get('/exclude-path/sub')
                    .ok({ expected: { result: 'success' } })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(1)
            })
        })

        describe('제외 목록이 빈 배열이면', () => {
            beforeEach(async () => {
                fix = await createSuccessLoggerInterceptorFixture([
                    { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: [] }
                ])
            })

            it('요청을 기록한다', async () => {
                await fix.httpClient.get('/exclude-path').ok({ expected: { result: 'success' } })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(1)
            })
        })

        describe('제외 목록에 두 경로가 있으면', () => {
            beforeEach(async () => {
                fix = await createSuccessLoggerInterceptorFixture([
                    {
                        provide: 'LOGGING_EXCLUDE_HTTP_PATHS',
                        useValue: ['/never-matches', '/exclude-path']
                    }
                ])
            })

            it('목록의 두 번째 경로로 요청해도 로그를 남기지 않는다', async () => {
                await fix.httpClient.get('/exclude-path').ok({ expected: { result: 'success' } })

                expect(fix.spyVerbose).toHaveBeenCalledTimes(0)
            })
        })
    })
})
