import { AdminAuthenticationService } from '../index.js'

describe('AdminAuthenticationService', () => {
    describe('isAuthPayloadActive', () => {
        it('토큰의 authVersion으로 계정 상태를 검증한다', async () => {
            const repository = { isAuthVersionCurrent: vi.fn().mockResolvedValue(true) }
            const service = new AdminAuthenticationService(repository as any, {} as any)

            await expect(
                service.isAuthPayloadActive({
                    authVersion: 2,
                    sub: 'admin-id',
                    email: 'admin@mail.com'
                })
            ).resolves.toBe(true)
            expect(repository.isAuthVersionCurrent).toHaveBeenCalledWith('admin-id', 2)
        })

        it('authVersion이 없는 토큰 payload는 거부한다', async () => {
            const repository = { isAuthVersionCurrent: vi.fn() }
            const service = new AdminAuthenticationService(repository as any, {} as any)

            await expect(
                service.isAuthPayloadActive({ sub: 'admin-id', email: 'admin@mail.com' })
            ).resolves.toBe(false)
            expect(repository.isAuthVersionCurrent).not.toHaveBeenCalled()
        })
    })
})
