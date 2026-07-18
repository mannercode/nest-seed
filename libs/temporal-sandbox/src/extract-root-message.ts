// Temporal 오류의 suppressed/cause 사슬에서 실제 메시지를 찾고 순환 참조에서는 멈춘다.
export function extractRootMessage(error: unknown): string {
    let current: unknown = error
    let message = ''
    while (current instanceof Error) {
        message = current.message
        const next: unknown = (current as { suppressed?: unknown }).suppressed ?? current.cause
        if (!next || next === current) break
        current = next
    }
    return message || String(error)
}
