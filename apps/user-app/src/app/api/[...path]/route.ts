import { createBffProxy } from '@mannercode/common/bff'

const proxy = createBffProxy({
    accessCookie: 'nest-seed-user-access',
    refreshCookie: 'nest-seed-user-refresh',
    authPrefix: 'users',
    apiBaseUrl: () => {
        const value = process.env.API_BASE_URL
        if (!value) throw new Error('API_BASE_URL is required')
        return value
    },
    secureCookies:
        process.env.BFF_COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production',
    trustProxyHeaders: process.env.BFF_TRUST_PROXY_HEADERS === 'true'
})

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const PUT = proxy
export const DELETE = proxy
