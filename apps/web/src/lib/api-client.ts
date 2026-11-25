export class ApiError extends Error {
    readonly status: number
    readonly code: string | undefined

    constructor(status: number, code: string | undefined, message: string) {
        super(message)
        this.status = status
        this.code = code
    }
}

async function request(method: string, path: string, body?: unknown): Promise<Response> {
    const response = await fetch(`/api${path}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    })
    if (!response.ok) {
        const parsed: unknown = await response.json().catch(() => null)
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
    return response
}

export async function getJson<T>(path: string): Promise<T> {
    return (await request('GET', path)).json()
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
    return (await request('POST', path, body)).json()
}

export async function postNoContent(path: string, body: unknown): Promise<void> {
    const response = await request('POST', path, body)
    if (response.status !== 204) {
        throw new ApiError(
            response.status,
            undefined,
            `POST ${path} expected HTTP 204, received ${response.status}`
        )
    }
}
