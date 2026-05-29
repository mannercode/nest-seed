// 브라우저에서 NestJS API로 보내는 fetch 래퍼이다.
// next.config.mjs의 `/api/*` rewrite를 거치므로 호출자는 호스트 주소 없이 경로만 넘긴다.
// 사용자 앱 홈은 게스트 접근이라 인증 토큰은 다루지 않는다.

export class ApiError extends Error {
    readonly status: number
    readonly code: string | undefined

    constructor(status: number, code: string | undefined, message: string) {
        super(message)
        this.status = status
        this.code = code
    }
}

export async function getJson<T>(path: string): Promise<T> {
    const response = await fetch(`/api${path}`, { method: 'GET' })

    const text = await response.text()
    const parsed = text ? (JSON.parse(text) as unknown) : null

    if (!response.ok) {
        const code =
            parsed && typeof parsed === 'object' && 'code' in parsed
                ? String(parsed.code)
                : undefined
        const message =
            parsed && typeof parsed === 'object' && 'message' in parsed
                ? String(parsed.message)
                : `GET ${path} failed with ${response.status}`
        throw new ApiError(response.status, code, message)
    }

    return parsed as T
}
