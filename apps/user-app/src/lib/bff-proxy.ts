import { isIP } from 'node:net'

export type AuthTokens = { accessToken: string; refreshToken: string }

type HeaderReader = Pick<Headers, 'get'>

export function hasSameOrigin(
    method: string,
    headers: HeaderReader,
    requestProtocol: string
): boolean {
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true

    const origin = headers.get('origin')
    if (origin === null) return true

    const host = headers.get('host')?.trim().toLowerCase()
    if (!host) return false

    try {
        const originUrl = new URL(origin)
        return originUrl.protocol === requestProtocol && originUrl.host.toLowerCase() === host
    } catch {
        return false
    }
}

export function resolveForwardedClientIp(
    headers: HeaderReader,
    trustProxyHeaders: boolean
): string | undefined {
    if (!trustProxyHeaders) return undefined

    const forwardedFor = headers.get('x-forwarded-for')
    if (forwardedFor !== null) {
        const appendedClientIp = forwardedFor.split(',').at(-1)?.trim()
        return appendedClientIp && isIP(appendedClientIp) !== 0 ? appendedClientIp : undefined
    }

    const realIp = headers.get('x-real-ip')?.trim()
    return realIp && isIP(realIp) !== 0 ? realIp : undefined
}

export async function retryWithRotatedSession<Response>({
    createUnavailableResponse,
    retry,
    setAuthTokens,
    tokens
}: {
    createUnavailableResponse: () => Response
    retry: () => Promise<Response>
    setAuthTokens: (response: Response, tokens: AuthTokens) => void
    tokens: AuthTokens
}): Promise<Response> {
    let response: Response
    try {
        response = await retry()
    } catch {
        response = createUnavailableResponse()
    }
    setAuthTokens(response, tokens)
    return response
}
