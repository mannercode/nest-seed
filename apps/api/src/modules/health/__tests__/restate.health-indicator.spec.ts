import type { AppConfigService } from 'config'
import { RestateHealthIndicator } from '../restate.health-indicator'

describe('RestateHealthIndicator', () => {
    const config = {
        restate: { ingressUrl: 'http://restate.test:8080', servicePort: 9080 }
    } as AppConfigService
    const indicator = new RestateHealthIndicator(config)

    afterEach(() => jest.restoreAllMocks())

    it('ingress health가 성공하면 up을 반환한다', async () => {
        const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response)

        await expect(indicator.isHealthy('restate')).resolves.toEqual({ restate: { status: 'up' } })
        expect(fetchSpy).toHaveBeenCalledWith('http://restate.test:8080/restate/health', {
            signal: expect.any(AbortSignal)
        })
    })

    it('ingress health가 HTTP 오류를 반환하면 down을 반환한다', async () => {
        jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response)

        await expect(indicator.isHealthy('restate')).resolves.toEqual({
            restate: { reason: 'HTTP 503', status: 'down' }
        })
    })

    it('health 요청 자체가 실패하면 원인을 포함한 down을 반환한다', async () => {
        jest.spyOn(globalThis, 'fetch').mockRejectedValue('offline')

        await expect(indicator.isHealthy('restate')).resolves.toEqual({
            restate: { reason: 'offline', status: 'down' }
        })
    })
})
