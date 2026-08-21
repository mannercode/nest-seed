const SENSITIVE_FIELDS = new Set([
    'password',
    'refreshtoken',
    'accesstoken',
    'token',
    'authorization',
    'secret',
    'apikey',
    'policy',
    'x-amz-credential',
    'x-amz-signature',
    'x-amz-security-token'
])

const REDACTED = '[REDACTED]'
const CIRCULAR = '[CIRCULAR]'
const PRESIGNED_URL_QUERY = /[?&](?:x-amz-(?:credential|signature|security-token)|policy)=/i

// 민감 필드를 가린 깊은 복사본을 만들며 순환 참조는 [CIRCULAR]로 축약한다.
export function redactSensitive<T>(value: T): T {
    return walk(value, new WeakSet<object>()) as T
}

function walk(value: unknown, seen: WeakSet<object>): unknown {
    if (typeof value === 'string' && PRESIGNED_URL_QUERY.test(value)) return REDACTED

    if (Array.isArray(value)) {
        if (seen.has(value)) return CIRCULAR
        seen.add(value)
        return value.map((v) => walk(v, seen))
    }
    if (value !== null && typeof value === 'object') {
        // Date·Error 같은 원자 값과 BSON 식별자는 직렬화 의미를 보존한다. 그 밖의 일반 객체는
        // 클래스 인스턴스여도 DTO일 수 있으므로 own enumerable 필드를 안전한 plain object로 복사한다.
        const bsonCandidate = value as { _bsontype?: unknown; toHexString?: unknown }
        if (
            Object.prototype.toString.call(value) !== '[object Object]' ||
            (typeof bsonCandidate._bsontype === 'string' &&
                typeof bsonCandidate.toHexString === 'function')
        ) {
            return value
        }

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
