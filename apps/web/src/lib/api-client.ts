export class ApiError extends Error {
    readonly status: number
    readonly code: string | undefined

    constructor(status: number, code: string | undefined, message: string) {
        super(message)
        this.status = status
        this.code = code
    }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'

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
                ? String(parsed.code)
                : undefined
        const message =
            parsed && typeof parsed === 'object' && 'message' in parsed
                ? String(parsed.message)
                : `${method} ${path} failed with ${response.status}`
        throw new ApiError(response.status, code, message)
    }

    return parsed as T
}

export const getJson = <T>(path: string) => request<T>('GET', path)
export const postJson = <T>(path: string, body: unknown) => request<T>('POST', path, body)
