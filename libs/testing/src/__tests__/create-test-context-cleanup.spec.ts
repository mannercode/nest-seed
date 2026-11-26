import type { INestApplication } from '@nestjs/common'
import { ExpressAdapter } from '@nestjs/platform-express'
import { createTestContext, createHttpTestContext } from '#testing'

describe('createTestContext, createHttpTestContext', () => {
    describe('HTTP 어댑터가 서버를 생성하지 못하면', () => {
        const failure = new Error('adapter init failed')
        beforeEach(() => {
            vi.spyOn(ExpressAdapter.prototype, 'initHttpServer').mockImplementationOnce(() => {
                throw failure
            })
        })
        it('이미 준비한 제공자를 정리하고 생성 오류를 던진다', async () => {
            const work = new AbortController()
            const provider = { provide: 'work', useValue: { onModuleDestroy: () => work.abort() } }
            await expect(createTestContext({ providers: [provider] })).rejects.toBe(failure)
            expect(work.signal.aborted).toBe(true)
        })
    })

    describe.each([
        { condition: '제공자의 초기화가 실패하면', destroy: () => {} },
        {
            condition: '초기화 실패 후 Nest가 제공자 종료 오류를 처리하면',
            destroy: () => {
                throw new Error('provider cleanup failed')
            }
        }
    ])('$condition', ({ destroy }) => {
        let setupError: Error
        let onModuleDestroy: ReturnType<typeof vi.fn<() => void>>
        let provider: new () => object
        beforeEach(() => {
            setupError = new Error('app init failed')
            onModuleDestroy = vi.fn(destroy)

            class InitFailureProvider {
                onModuleInit() {
                    throw setupError
                }

                onModuleDestroy() {
                    onModuleDestroy()
                }
            }
            provider = InitFailureProvider
        })
        it('모듈을 정리하고 최초 오류를 던진다', async () => {
            const result = createTestContext({ providers: [provider] })

            await expect(result).rejects.toBe(setupError)
            expect(onModuleDestroy).toHaveBeenCalledTimes(1)
        })
    })

    describe('HTTP 앱의 URL을 얻지 못하면', () => {
        let setupError: Error
        let onModuleDestroy: ReturnType<typeof vi.fn<() => void>>
        let app: INestApplication | undefined
        let options: Parameters<typeof createHttpTestContext>[0]
        beforeEach(() => {
            setupError = new Error('getUrl failed')
            onModuleDestroy = vi.fn()
            app = undefined

            class LifecycleProvider {
                onModuleDestroy() {
                    onModuleDestroy()
                }
            }
            options = {
                configureApp: async (createdApp) => {
                    app = createdApp
                    vi.spyOn(createdApp, 'getUrl').mockRejectedValue(setupError)
                },
                providers: [LifecycleProvider]
            }
        })
        it('서버와 모듈을 닫고 URL 조회 오류를 던진다', async () => {
            const result = createHttpTestContext(options)

            await expect(result).rejects.toBe(setupError)
            expect(app?.getHttpServer().listening).toBe(false)
            expect(onModuleDestroy).toHaveBeenCalledTimes(1)
        })
    })

    describe('제공자 초기화와 HTTP 어댑터 종료가 모두 실패하면', () => {
        const setupError = new Error('app init failed')
        const cleanupError = new Error('app cleanup failed')
        let provider: new () => object
        beforeEach(() => {
            class SetupAndCleanupFailureProvider {
                onModuleInit() {
                    throw setupError
                }
            }
            provider = SetupAndCleanupFailureProvider
        })
        it('두 오류를 함께 던진다', async () => {
            const result = createTestContext({
                providers: [provider],
                configureApp: async (app) => {
                    vi.spyOn(app.getHttpAdapter(), 'close').mockRejectedValueOnce(cleanupError)
                }
            })

            await expect(result).rejects.toMatchObject({
                name: 'SuppressedError',
                error: cleanupError,
                suppressed: setupError
            })
        })
    })

    describe('HTTP 리스너 시작과 어댑터 종료가 모두 실패하면', () => {
        const listenError = new Error('listen failed')
        const cleanupError = new Error('cleanup failed')
        it('두 오류를 함께 던진다', async () => {
            const result = createHttpTestContext({
                configureApp: async (app) => {
                    vi.spyOn(app, 'listen').mockRejectedValueOnce(listenError)
                    vi.spyOn(app.getHttpAdapter(), 'close').mockRejectedValueOnce(cleanupError)
                }
            })
            await expect(result).rejects.toMatchObject({
                name: 'SuppressedError',
                error: cleanupError,
                suppressed: listenError
            })
        })
    })
})
