import { RestateHealthIndicator } from '#common/health'
import type { MockInstance } from 'vitest'

describe('RestateHealthIndicator', () => {
    const indicator = new RestateHealthIndicator('http://restate.test:8080')

    afterEach(() => vi.restoreAllMocks())

    describe('Restate 상태 확인에 성공하면', () => {
        let fetchSpy: MockInstance<typeof fetch>
        beforeEach(() => {
            fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)
        })
        it('ingress의 상태 확인 경로를 호출하고 up을 반환한다', async () => {
            await expect(indicator.isHealthy('restate')).resolves.toEqual({
                restate: { status: 'up' }
            })
            expect(fetchSpy).toHaveBeenCalledWith('http://restate.test:8080/restate/health', {
                signal: expect.any(AbortSignal)
            })
        })
    })

    describe('Restate가 503을 반환하면', () => {
        beforeEach(() => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response)
        })
        it('HTTP 상태 코드와 down 상태를 반환한다', async () => {
            await expect(indicator.isHealthy('restate')).resolves.toEqual({
                restate: { reason: 'HTTP 503', status: 'down' }
            })
        })
    })

    describe('Restate 상태 확인에 실패하면', () => {
        beforeEach(() => {
            vi.spyOn(globalThis, 'fetch').mockRejectedValue('offline')
        })
        it('실패 원인과 down 상태를 반환한다', async () => {
            await expect(indicator.isHealthy('restate')).resolves.toEqual({
                restate: { reason: 'offline', status: 'down' }
            })
        })
    })
})
