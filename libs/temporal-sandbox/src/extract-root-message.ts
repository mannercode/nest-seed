/**
 * Error의 `cause`(또는 `suppressed`) 체인을 끝까지 따라가 가장 안쪽 메시지를 돌려준다.
 * Temporal이 `ActivityFailure`로 감싸 던지면 바깥 메시지가 "Activity task failed" 같은
 * 일반 문구가 되고, 우리가 만든 도메인 메시지는 안쪽 `cause`에 들어 있어서, 사용자에게
 * 보여줄 메시지를 결정할 때 끝까지 따라가야 한다.
 *
 * `await using`의 disposer가 다시 던지는 경우에는 원래 에러가 `suppressed` 슬롯으로
 * 밀려나므로 그 슬롯을 먼저 본다. 자기 자신을 참조하는 순환 구조는 한 번만 보고 끊는다.
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
