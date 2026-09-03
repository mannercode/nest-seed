import type { INestApplication } from '@nestjs/common'
import { createTestContext, createHttpTestContext } from '../index.js'

describe('test context setup cleanup', () => {
    it('앱 초기화가 실패하면 모듈을 정리하고 원래 오류를 다시 던진다', async () => {
        const setupError = new Error('app init failed')
        const onModuleDestroy = vi.fn()

        class InitFailureProvider {
            onModuleInit() {
                throw setupError
            }

            onModuleDestroy() {
                onModuleDestroy()
            }
        }

        const result = createTestContext({ providers: [InitFailureProvider] })

        await expect(result).rejects.toBe(setupError)
        expect(onModuleDestroy).toHaveBeenCalledTimes(1)
    })

    it('HTTP URL 조회가 실패하면 열린 서버와 모듈을 정리하고 원래 오류를 다시 던진다', async () => {
        const setupError = new Error('getUrl failed')
        const onModuleDestroy = vi.fn()
        let app: INestApplication | undefined

        class LifecycleProvider {
            onModuleDestroy() {
                onModuleDestroy()
            }
        }

        const result = createHttpTestContext({
            configureApp: async (createdApp) => {
                app = createdApp
                vi.spyOn(createdApp, 'getUrl').mockRejectedValue(setupError)
            },
            providers: [LifecycleProvider]
        })

        await expect(result).rejects.toBe(setupError)
        expect(app?.getHttpServer().listening).toBe(false)
        expect(onModuleDestroy).toHaveBeenCalledTimes(1)
    })

    it('실패 정리도 실패하면 최초 설정 오류를 유지한다', async () => {
        const setupError = new Error('app init failed')

        class SetupAndCleanupFailureProvider {
            onModuleInit() {
                throw setupError
            }

            onModuleDestroy() {
                throw new Error('app cleanup failed')
            }
        }

        const result = createTestContext({ providers: [SetupAndCleanupFailureProvider] })

        await expect(result).rejects.toBe(setupError)
    })
})
