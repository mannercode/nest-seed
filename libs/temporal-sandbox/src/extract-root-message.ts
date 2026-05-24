/**
 * 감싸진 오류를 안쪽까지 살펴 애플리케이션이 만든 실제 메시지를 꺼낸다.
 * Temporal 작업이 실패하면 바깥 오류에는 일반적인 실패 문구만 들어가고,
 * 원래 메시지는 안쪽 `cause`에 들어갈 수 있다.
 *
 * 정리 작업 중 다시 오류가 난 경우 원래 오류는 `suppressed`에 보관되므로
 * 그 값을 먼저 확인한다. 오류가 자기 자신을 가리키면 순회를 멈춘다.
 */
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
