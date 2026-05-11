/**
 * 브라우저에서 NestJS API로 보내는 fetch 래퍼입니다. console은
 * `next.config.mjs`의 `/api/*` rewrite를 거쳐 API로 갑니다. 호출자는 origin
 * 없이 경로만 넘기면 됩니다.
 */

export class ApiError extends Error {
    readonly status: number
    readonly code: string | undefined

    constructor(status: number, code: string | undefined, message: string) {
        super(message)
        this.status = status
        this.code = code
    }
}

type RequestOptions = { body?: unknown; accessToken?: string }

async function request<T>(
    method: string,
    path: string,
    { body, accessToken }: RequestOptions = {}
): Promise<T> {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`

    const response = await fetch(`/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    })

    if (response.status === 204) {
        return undefined as T
    }

    const text = await response.text()
    const parsed = text ? (JSON.parse(text) as unknown) : null

    if (!response.ok) {
        const code =
            parsed && typeof parsed === 'object' && 'code' in parsed
                ? String((parsed as { code: unknown }).code)
                : undefined
        const message =
            parsed && typeof parsed === 'object' && 'message' in parsed
                ? String((parsed as { message: unknown }).message)
                : `${method} ${path} failed with ${response.status}`
        throw new ApiError(response.status, code, message)
    }

    return parsed as T
}

export const api = {
    get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
    post: <T>(path: string, opts?: RequestOptions) => request<T>('POST', path, opts),
    patch: <T>(path: string, opts?: RequestOptions) => request<T>('PATCH', path, opts),
    delete: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts)
}
