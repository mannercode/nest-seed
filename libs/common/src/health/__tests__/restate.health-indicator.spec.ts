import { RestateHealthIndicator } from '../index.js'
import type { MockInstance } from 'vitest'

describe('RestateHealthIndicator', () => {
    const indicator = new RestateHealthIndicator('http://restate.test:8080')

    afterEach(() => vi.restoreAllMocks())

    describe('Restate health 요청이 성공하도록 설정하면', () => {
        let fetchSpy: MockInstance<typeof fetch>
        beforeEach(() => {
            fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)
        })
        it('상태 조회 시 ingress health 경로를 호출하고 up을 반환한다', async () => {
            await expect(indicator.isHealthy('restate')).resolves.toEqual({
                restate: { status: 'up' }
            })
            expect(fetchSpy).toHaveBeenCalledWith('http://restate.test:8080/restate/health', {
                signal: expect.any(AbortSignal)
            })
        })
    })

    describe('Restate health 요청이 HTTP 503을 반환하도록 설정하면', () => {
        beforeEach(() => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response)
        })
        it('상태 조회 시 HTTP 상태 코드와 down 상태를 반환한다', async () => {
            await expect(indicator.isHealthy('restate')).resolves.toEqual({
                restate: { reason: 'HTTP 503', status: 'down' }
            })
        })
    })

    describe('Restate health 요청이 실패하도록 설정하면', () => {
        beforeEach(() => {
            vi.spyOn(globalThis, 'fetch').mockRejectedValue('offline')
        })
        it('상태 조회 시 실패 원인과 down 상태를 반환한다', async () => {
            await expect(indicator.isHealthy('restate')).resolves.toEqual({
                restate: { reason: 'offline', status: 'down' }
            })
        })
    })
})
