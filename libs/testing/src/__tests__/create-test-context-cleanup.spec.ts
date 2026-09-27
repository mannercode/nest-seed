import type { INestApplication } from '@nestjs/common'
import { createTestContext, createHttpTestContext } from '../index.js'

describe('createTestContext, createHttpTestContext', () => {
    describe('제공자의 초기화가 실패하도록 설정하면', () => {
        let setupError: Error
        let onModuleDestroy: ReturnType<typeof vi.fn<() => void>>
        let provider: new () => object
        beforeEach(() => {
            setupError = new Error('app init failed')
            onModuleDestroy = vi.fn()

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
        it('앱 생성 시 모듈을 정리하고 최초 초기화 오류를 던진다', async () => {
            const result = createTestContext({ providers: [provider] })

            await expect(result).rejects.toBe(setupError)
            expect(onModuleDestroy).toHaveBeenCalledTimes(1)
        })
    })

    describe('HTTP 앱의 URL 조회가 실패하도록 설정하면', () => {
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
        it('HTTP 컨텍스트 생성 시 서버와 모듈을 닫고 URL 조회 오류를 던진다', async () => {
            const result = createHttpTestContext(options)

            await expect(result).rejects.toBe(setupError)
            expect(app?.getHttpServer().listening).toBe(false)
            expect(onModuleDestroy).toHaveBeenCalledTimes(1)
        })
    })

    describe('제공자의 초기화와 정리가 모두 실패하도록 설정하면', () => {
        let setupError: Error
        let provider: new () => object
        beforeEach(() => {
            setupError = new Error('app init failed')

            class SetupAndCleanupFailureProvider {
                onModuleInit() {
                    throw setupError
                }

                onModuleDestroy() {
                    throw new Error('app cleanup failed')
                }
            }
            provider = SetupAndCleanupFailureProvider
        })
        it('앱 생성 시 최초 초기화 오류를 던진다', async () => {
            const result = createTestContext({ providers: [provider] })

            await expect(result).rejects.toBe(setupError)
        })
    })
})
