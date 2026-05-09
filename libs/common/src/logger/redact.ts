const SENSITIVE_FIELDS = new Set([
    'password',
    'refreshtoken',
    'accesstoken',
    'token',
    'authorization',
    'secret',
    'apikey'
])

const REDACTED = '[REDACTED]'
const CIRCULAR = '[CIRCULAR]'

/**
 * 잘 알려진 민감 key (password, refreshToken, accessToken, …) 의 값을
 * `[REDACTED]` 로 치환한 deep copy 를 돌려준다. HTTP request/response body
 * 가 log sink 에 도달하기 전에 가리는 데 쓴다.
 *
 * self-referential graph 도 허용한다 — 같은 object 를 다시 방문하면 무한
 * recursion 대신 `[CIRCULAR]` 로 접는다. (예: error logging 경로에 가끔
 * 끼어드는 `error.cause = error` 같은 chain.)
 */
export function redactSensitive<T>(value: T): T {
    return walk(value, new WeakSet<object>()) as T
}

function walk(value: unknown, seen: WeakSet<object>): unknown {
    if (Array.isArray(value)) {
        if (seen.has(value)) return CIRCULAR
        seen.add(value)
        return value.map((v) => walk(v, seen))
    }
    if (value !== null && typeof value === 'object') {
        if (seen.has(value)) return CIRCULAR
        seen.add(value)
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = SENSITIVE_FIELDS.has(k.toLowerCase()) ? REDACTED : walk(v, seen)
        }
        return out
    }
    return value
}
