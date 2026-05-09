/**
 * Temporal 은 activity 에러를 `ActivityFailure` 로 감싸는데, 그 자신의
 * `message` 는 일반적인 "Activity task failed" 다. 던져진 HttpException 의
 * message 는 더 안쪽에 있다. `cause` 표준 체인을 따라가면서 `SuppressedError`
 * 의 `suppressed` slot 도 함께 본다 (다른 에러가 진행 중일 때 `await using`
 * disposal 이 던지면 발생 — disposal 에러가 primary 가 되고 원본이
 * "suppressed" 가 된다). disposal 잡음보다 원본을 우선한다.
 *
 * `workflows.ts` 바깥에 둬서 coverage 까지 unit test 할 수 있게 한다 —
 * `bundleWorkflowCode` 는 workflow 코드를 sandbox VM 에서 실행하는데, Jest 의
 * istanbul instrumentation 이 그걸 보지 못하므로 workflow 모듈 안의 코드는
 * integration test 가 실행해도 0% coverage 로 잡힌다.
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
