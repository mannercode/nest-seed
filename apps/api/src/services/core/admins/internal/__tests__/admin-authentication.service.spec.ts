import { AdminAuthenticationService } from '..'

describe('AdminAuthenticationService', () => {
    describe('isAuthPayloadActive', () => {
        it('authVersion이 없는 기존 토큰을 version 0으로 검증한다', async () => {
            const repository = { isAuthVersionCurrent: jest.fn().mockResolvedValue(true) }
            const service = new AdminAuthenticationService(repository as any, {} as any)

            await expect(
                service.isAuthPayloadActive({ sub: 'admin-id', email: 'admin@mail.com' })
            ).resolves.toBe(true)
            expect(repository.isAuthVersionCurrent).toHaveBeenCalledWith('admin-id', 0)
        })

        it('필수 claim이 없는 토큰 payload는 거부한다', async () => {
            const repository = { isAuthVersionCurrent: jest.fn() }
            const service = new AdminAuthenticationService(repository as any, {} as any)

            await expect(service.isAuthPayloadActive({})).resolves.toBe(false)
            expect(repository.isAuthVersionCurrent).not.toHaveBeenCalled()
        })
    })
})
