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

/**
 * Returns a deep-copied value with values of well-known sensitive keys
 * (password, refreshToken, accessToken, …) replaced by `[REDACTED]`. Used
 * to scrub HTTP request/response bodies before they reach log sinks.
 */
export function redactSensitive<T>(value: T): T {
    return walk(value) as T
}

function walk(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(walk)
    if (value !== null && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = SENSITIVE_FIELDS.has(k.toLowerCase()) ? REDACTED : walk(v)
        }
        return out
    }
    return value
}
