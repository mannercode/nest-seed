// 모든 connection-leak spec 이 공유하는 probe helper. 라벨과 함께
// process.memoryUsage() 를 stderr 로 찍는다. global.gc() 는 호출하지
// 않는다 — 측정 도구 영향 최소화.
function probe(label) {
    const m = process.memoryUsage()
    const mb = (n) => (n / 1024 / 1024).toFixed(0)
    process.stderr.write(
        `[conn-leak] ${label.padEnd(28)} rss=${mb(m.rss).padStart(5)} heap=${mb(m.heapUsed).padStart(5)} ext=${mb(m.external).padStart(5)} arrBuf=${mb(m.arrayBuffers).padStart(5)}\n`
    )
}

module.exports = { probe }
