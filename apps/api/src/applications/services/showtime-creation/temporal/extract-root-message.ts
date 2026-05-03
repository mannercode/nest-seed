/**
 * Temporal wraps activity errors in `ActivityFailure` whose own `message` is
 * a generic "Activity task failed". The thrown HttpException's message lives
 * deeper. Walk `cause` (standard chain) plus the `suppressed` slot of
 * `SuppressedError` (raised when an `await using` disposal throws while
 * another error is in flight — the disposal error becomes primary, the
 * original is "suppressed"). We prefer the original over the disposal noise.
 *
 * Lives outside `workflows.ts` so it can be unit-tested with coverage —
 * `bundleWorkflowCode` runs workflow code in a sandbox VM that Jest's
 * istanbul instrumentation can't see, so anything inside the workflow
 * module reads as 0% coverage even when integration tests exercise it.
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
