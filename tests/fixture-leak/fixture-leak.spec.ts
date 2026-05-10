// apps/api 의 createAppTestContext 를 N 번 부팅·teardown 하면서 매번 GC 후
// process.memoryUsage() + V8 heap stats 를 출력한다. fixture 단위 누수량을
// 정확히 잡기 위함.
//
// 한 testFile 안에서 fixture 만 N 번 부팅하므로 jest 의 testFile 전환 효과,
// resetModules 효과는 끼어들지 않는다. 누수가 fixture 부팅에 비례한다면
// fixture-당 증가량이 일정해야 한다 — 실측에서는 첫 부팅 +130MB, 이후는
// 거의 0. 즉 fixture 자체는 누수 거의 없다.
import { createAppTestContext } from '../../apps/api/src/__tests__/integration/helpers'

const probe = (label: string) => {
    if (global.gc) {
        global.gc()
        global.gc()
    }
    const m = process.memoryUsage()
    const v8 = require('v8') as typeof import('v8')
    const h = v8.getHeapStatistics()
    const mb = (n: number) => (n / 1024 / 1024).toFixed(0)
    process.stderr.write(
        `\n[fixture-leak] ${label} rss=${mb(m.rss)} heap=${mb(m.heapUsed)} heapTotal=${mb(m.heapTotal)} ext=${mb(m.external)} arrBuf=${mb(m.arrayBuffers)} exec=${mb(h.total_heap_size_executable)} malloced=${mb(h.malloced_memory)}\n`
    )
}

describe('fixture leak probe', () => {
    it(
        'boots fixture N times and prints memory after each',
        async () => {
            const N = parseInt(process.env.FIXTURE_LEAK_N ?? '6', 10)
            probe('baseline')
            for (let i = 1; i <= N; i++) {
                const ctx = await createAppTestContext()
                await ctx.teardown()
                probe(`after-fixture-${i}`)
            }
        },
        15 * 60 * 1000
    )
})
