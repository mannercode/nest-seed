/**
 * `predicate` 가 true 를 반환하거나 `timeoutMs` 가 경과할 때까지 폴링한다.
 * NATS 전달은 async 라 emit 직후에 assert 할 수 없다.
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
