// 한 fixture 부팅 + N 번 비즈니스 호출 (it 격리 없음). 누수가 비즈니스
// 호출 자체에서 오는지 it 격리 사이클에서 오는지 분리.
//
// resetModules:true 환경이라 helpers 도 dynamic import (movies.spec.ts 패턴).
// top-level static import 면 spec 파일 evaluate 시점의 'core' 와 it 안
// fresh evaluate 의 'core' 가 다른 instance 가 돼 NestJS DI 가 못 찾는다.

const probe = (label: string) => {
    const m = process.memoryUsage()
    const mb = (n: number) => (n / 1024 / 1024).toFixed(0)
    process.stderr.write(
        `[fixture-once] ${label.padEnd(28)} rss=${mb(m.rss).padStart(5)} heap=${mb(m.heapUsed).padStart(5)} ext=${mb(m.external).padStart(5)} arrBuf=${mb(m.arrayBuffers).padStart(5)}\n`
    )
}

describe('fixture-once + N business calls', () => {
    it(
        'createMovie × N',
        async () => {
            const helpers = await import(
                '../../apps/api/src/__tests__/integration/helpers'
            )
            const N = parseInt(process.env.LEAK_N ?? '40', 10)
            const fix = await helpers.createAppTestContext()
            try {
                probe('after-fixture-boot')
                for (let i = 1; i <= N; i++) {
                    await helpers.createMovie(fix)
                    if (i === 1 || i % 5 === 0) probe(`after-call-${i}`)
                }
            } finally {
                await fix.teardown()
            }
        },
        15 * 60 * 1000
    )
})
