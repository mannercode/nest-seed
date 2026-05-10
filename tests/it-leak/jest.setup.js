// it block 단위 메모리 측정. 추가로 jest 가 어떤 spec 의 어떤 it 끝에서
// process.memoryUsage() 가 어떤 값인지 stderr 에 찍는다.
//
// 의도적으로 global.gc() 는 호출하지 않는다 — 측정 도구가 누수에 영향
// 안 주는 게 우선. 누수면 시간이 가도 RSS 가 줄지 않는다.
afterEach(() => {
    const m = process.memoryUsage()
    const mb = (n) => (n / 1024 / 1024).toFixed(0)
    const state = expect.getState()
    const file = state.testPath?.replace(/^.*__tests__\//, '') ?? '?'
    const name = state.currentTestName ?? '?'
    process.stderr.write(
        `[it-leak] ${file} :: ${name} rss=${mb(m.rss)} heap=${mb(m.heapUsed)} ext=${mb(m.external)} arrBuf=${mb(m.arrayBuffers)}\n`
    )
})
