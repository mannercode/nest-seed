import { expect, test } from '@playwright/test'
import { resolveForwardedClientIp, retryWithRotatedSession } from '@mannercode/frontend/bff'

type SessionResponse = { cookies: Map<string, string>; status: number }

const tokens = { accessToken: 'rotated-access', refreshToken: 'rotated-refresh' }

test.describe('BFF proxy', () => {
    test('직접 노출 기본값에서는 브라우저가 보낸 proxy IP 헤더를 신뢰하지 않는다', () => {
        const headers = new Headers({
            'X-Forwarded-For': '203.0.113.7',
            'X-Real-IP': '203.0.113.8'
        })

        expect(resolveForwardedClientIp(headers, false)).toBeUndefined()
    })

    test('신뢰 proxy가 append한 체인에서는 공격자 입력이 아닌 오른쪽 끝 IP를 쓴다', () => {
        const headers = new Headers({ 'X-Forwarded-For': '192.0.2.66, unknown, 198.51.100.24' })

        expect(resolveForwardedClientIp(headers, true)).toBe('198.51.100.24')
    })

    test('append 경계의 오른쪽 끝 값이 IP가 아니면 앞쪽의 공격자 IP로 후퇴하지 않는다', () => {
        const headers = new Headers({ 'X-Forwarded-For': '192.0.2.66, invalid-proxy-value' })

        expect(resolveForwardedClientIp(headers, true)).toBeUndefined()
    })

    test('refresh 성공 뒤 원 요청 retry가 실패해도 502에 회전 쿠키를 보존한다', async () => {
        const response = await retryWithRotatedSession<SessionResponse>({
            createUnavailableResponse: () => ({ cookies: new Map(), status: 502 }),
            retry: async () => {
                throw new Error('upstream connection reset')
            },
            setAuthTokens: (target, rotated) => {
                target.cookies.set('access', rotated.accessToken)
                target.cookies.set('refresh', rotated.refreshToken)
            },
            tokens
        })

        expect(response.status).toBe(502)
        expect(Object.fromEntries(response.cookies)).toEqual({
            access: tokens.accessToken,
            refresh: tokens.refreshToken
        })
    })

    test('원 요청 retry가 성공할 때도 회전 쿠키를 보존한다', async () => {
        const response = await retryWithRotatedSession<SessionResponse>({
            createUnavailableResponse: () => ({ cookies: new Map(), status: 502 }),
            retry: async () => ({ cookies: new Map(), status: 200 }),
            setAuthTokens: (target, rotated) => {
                target.cookies.set('access', rotated.accessToken)
                target.cookies.set('refresh', rotated.refreshToken)
            },
            tokens
        })

        expect(response.status).toBe(200)
        expect(Object.fromEntries(response.cookies)).toEqual({
            access: tokens.accessToken,
            refresh: tokens.refreshToken
        })
    })
})
