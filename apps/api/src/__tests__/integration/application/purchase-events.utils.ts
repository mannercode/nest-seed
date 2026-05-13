/**
 * `predicate`가 true가 되거나 `timeoutMs`가 지날 때까지 짧은 간격으로
 * 다시 확인한다. NATS 전달은 비동기라서, `emit` 직후에 즉시 단언할 수 없다.
 */
export async function waitFor(predicate: () => boolean, timeoutMs = 2000) {
    const start = Date.now()
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error(`waitFor timed out after ${timeoutMs}ms`)
        }
        await new Promise((r) => setTimeout(r, 10))
    }
}
