/**
 * Temporal은 액티비티 에러를 `ActivityFailure`로 감싸 던집니다. 바깥 에러의
 * `message`는 늘 "Activity task failed" 같은 일반 문구입니다. 우리가 만든
 * `HttpException`의 메시지는 내부 원인에 들어 있습니다. 그래서 `cause` 체인을
 * 끝까지 따라갑니다.
 *
 * 중간에 `SuppressedError`가 끼는 경우도 봅니다. 다른 에러가 흘러가는 중에
 * `await using`의 disposer가 또 던지면, disposer가 던진 에러가 주 에러가 되고
 * 원래 에러는 `suppressed` 슬롯으로 밀려납니다. 사용자 입장에선 원래 에러가
 * 더 중요하므로 해당 구현을 먼저 봅니다.
 *
 * 이 함수는 `workflows.ts`와 분리해서 둡니다. 워크플로우 코드는
 * `bundleWorkflowCode`가 만든 샌드박스 VM 안에서 실행되는데, 거기서는 Jest의
 * istanbul 계측이 닿지 않습니다. 워크플로우 안에 두면 통합 테스트로 실행해도
 * 커버리지가 0%로 나옵니다. 분리해 두면 단위 테스트로 커버리지를 확보할 수
 * 있습니다.
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
