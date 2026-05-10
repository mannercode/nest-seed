// fixture-per-it + 비즈니스 호출 1 개. movies.spec.ts 단순 모사. 실제 이
// 패턴이 +49MB/it 의 큰 누수원인지 분리 확인.
//
// resetModules:true (기본) vs RESET_MODULES=false 로 비교하면 resetModules
// 의 비중이 정확히 가시화된다.

const probe = (label: string) => {
    const m = process.memoryUsage()
    const mb = (n: number) => (n / 1024 / 1024).toFixed(0)
    process.stderr.write(
        `[fpi-call] ${label.padEnd(28)} rss=${mb(m.rss).padStart(5)} heap=${mb(m.heapUsed).padStart(5)} ext=${mb(m.external).padStart(5)} arrBuf=${mb(m.arrayBuffers).padStart(5)}\n`
    )
}

describe('fixture-per-it + 1 createMovie call per it', () => {
    let fix: any
    let createMovie: any

    beforeEach(async () => {
        const helpers = await import(
            '../../apps/api/src/__tests__/integration/helpers'
        )
        fix = await helpers.createAppTestContext()
        createMovie = helpers.createMovie
    })

    afterEach(async () => {
        await fix.teardown()
    })

    for (let i = 1; i <= 15; i++) {
        it(`call ${i}`, async () => {
            await createMovie(fix)
            probe(`after-it-${i}`)
        })
    }
})
