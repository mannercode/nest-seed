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
 * 미리 정해 둔 민감 키(`password`, `refreshToken`, `accessToken` 등)의 값을
 * `[REDACTED]`로 바꾼 깊은 복사본을 반환한다. HTTP 요청·응답 본문이 로그에
 * 닿기 전에 가리는 용도이다.
 *
 * 객체끼리 서로를 참조하는 자가 순환 그래프도 안전하게 처리한다. 같은
 * 객체를 다시 만나면 끝없이 재귀하지 않고 `[CIRCULAR]`로 축약한다. 예를 들어
 * 에러 로깅 경로에 포함되는 `error.cause = error` 같은 사슬이 그렇다.
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
