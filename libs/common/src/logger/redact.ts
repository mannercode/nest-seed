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

// 민감 필드를 가린 깊은 복사본을 만들며 순환 참조는 [CIRCULAR]로 축약한다.
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
        // Date·Error·ObjectId 같은 클래스 인스턴스를 entries로 복사하면 빈 객체가 되어 값이 사라진다.
        // 민감 키는 plain object의 속성으로만 들어오므로, plain이 아닌 값은 그대로 통과시킨다.
        const proto = Object.getPrototypeOf(value)
        if (proto !== null && proto !== Object.prototype) return value

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
