// 시간이 겹치는 상영 생성 saga 들이 동시에 들어왔을 때 분산 락이 한 건만
// 통과시키는지 검증하는 부하 테스트입니다.
//
// 한 회차는 이렇게 진행됩니다. saga 요청 여러 건을 한꺼번에 보냅니다. 각 요청의
// 시작 시각을 어긋나게 두면서 길이를 충분히 길게 설정해, 어떤 두 요청을 골라도
// 시간이 겹치게 만듭니다. 복제본마다 Temporal 워커가 한 대씩 실행 중이어서 여러
// 워크플로우가 동시에 실행되지만, 검증·삽입 분산 락을 획득한 saga 한 건만 성공
// 합니다. 기대 결과는 정확히 한 건이 succeeded, 나머지는 failed입니다.
//
// 다음 중 하나라도 해당하면 실패로 봅니다. 둘 이상이 succeeded이거나,
// 아무도 성공하지 못하거나, 시간 안에 saga가 종료 상태에 도달하지 못한
// 경우.

const http = require('http')

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000'
const OVERLAP_COUNT = Number(process.env.OVERLAP_COUNT || 5)
const INNER_ITERATIONS = Number(process.env.INNER_ITERATIONS || 300)
const SAGA_DEADLINE_MS = Number(process.env.SAGA_DEADLINE_MS || 300_000)

function requestJson(method, path, body) {
    const url = new URL(path, SERVER_URL)
    const payload = body === undefined ? undefined : JSON.stringify(body)
    const agent = new http.Agent({ keepAlive: false })
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                agent,
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method,
                headers: {
                    'content-type': 'application/json',
                    ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {})
                }
            },
            (res) => {
                const chunks = []
                res.on('data', (c) => chunks.push(c))
                res.on('end', () => {
                    const raw = Buffer.concat(chunks).toString('utf8')
                    resolve({
                        status: res.statusCode,
                        body: raw ? JSON.parse(raw) : null,
                        replicaId: res.headers['x-replica-id']
                    })
                    agent.destroy()
                })
            }
        )
        req.on('error', reject)
        if (payload) req.write(payload)
        req.end()
    })
}

function openSseCollector() {
    const url = new URL('/showtime-creation/event-stream', SERVER_URL)
    const agent = new http.Agent({ keepAlive: false })
    const events = []
    let done = false

    const connected = new Promise((resolve, reject) => {
        const req = http.request(
            {
                agent,
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'GET',
                headers: { accept: 'text/event-stream' }
            },
            (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`SSE status ${res.statusCode}`))
                    return
                }
                res.setEncoding('utf8')
                let buffer = ''
                res.on('data', (chunk) => {
                    if (done) return
                    buffer += chunk
                    let idx
                    while ((idx = buffer.indexOf('\n\n')) !== -1) {
                        const frame = buffer.slice(0, idx)
                        buffer = buffer.slice(idx + 2)
                        const dataLine = frame.split('\n').find((line) => line.startsWith('data:'))
                        if (!dataLine) continue
                        try {
                            events.push(JSON.parse(dataLine.slice('data:'.length).trim()))
                        } catch {
                            /* 무시 */
                        }
                    }
                })
                resolve({ res, req, agent })
            }
        )
        req.on('error', reject)
        req.end()
    })

    const close = async () => {
        done = true
        const { res, req, agent: a } = await connected
        res.destroy()
        req.destroy()
        a.destroy()
    }

    return { connected, events, close }
}

async function waitUntil(predicate, { timeoutMs, intervalMs = 100 } = {}) {
    const start = Date.now()
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) return false
        await new Promise((r) => setTimeout(r, intervalMs))
    }
    return true
}

async function setupFixture() {
    const movie = await requestJson('POST', '/movies', {
        title: 'overlap',
        genres: ['action'],
        releaseDate: '2024-01-01T00:00:00.000Z',
        plot: 'overlap plot',
        durationInSeconds: 7200,
        director: 'overlap',
        rating: 'PG',
        assetIds: []
    })
    if (movie.status !== 201) throw new Error(`movie: ${movie.status}`)

    const publish = await requestJson('POST', `/movies/${movie.body.id}/publish`)
    if (publish.status !== 200 && publish.status !== 201) {
        throw new Error(`publish: ${publish.status}`)
    }

    const theater = await requestJson('POST', '/theaters', {
        name: 'overlap',
        location: { latitude: 37.5665, longitude: 126.978 },
        seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', layout: 'OOOOOOOO' }] }] }
    })
    if (theater.status !== 201) throw new Error(`theater: ${theater.status}`)

    return { movieId: movie.body.id, theaterId: theater.body.id }
}

async function runInner(iteration, movieId, theaterId, sse, baseOffsetMs) {
    // N 개 saga, startTime은 10분씩 어긋나고 각 120 분 길이.
    // 즉 saga 들은 base, base+10m, base+20m, ..., base+(N-1)×10m에 위치.
    // 마지막 saga는 base + (N-1)×10m + 120m에 끝납니다.
    // 모든 pair가 겹친다: 인접 pair는 110m 겹치고, 처음/끝 pair는
    // 120m − (N-1)×10m만큼 겹친다 (N ≤ 13이면 양수).
    const base = new Date(Date.now() + 24 * 60 * 60 * 1000 + baseOffsetMs)
    base.setUTCSeconds(0, 0)
    base.setUTCMinutes(0)
    const toIso = (d) => d.toISOString().replace(/\.\d{3}Z$/, '.000Z')

    const startTimes = Array.from({ length: OVERLAP_COUNT }, (_, i) =>
        toIso(new Date(base.getTime() + i * 10 * 60 * 1000))
    )

    const posts = await Promise.all(
        startTimes.map((startTime) =>
            requestJson('POST', '/showtime-creation/showtimes', {
                movieId,
                theaterIds: [theaterId],
                durationInMinutes: 120,
                startTimes: [startTime]
            })
        )
    )

    const sagaIds = posts.map((p, i) => {
        if (p.status !== 202) throw new Error(`iter ${iteration} post ${i}: ${p.status}`)
        return p.body.sagaId
    })

    const terminal = ['succeeded', 'failed', 'error']
    const outcomeOf = (sagaId) =>
        sse.events.find((e) => e.sagaId === sagaId && terminal.includes(e.status))

    const ok = await waitUntil(() => sagaIds.every((id) => outcomeOf(id)), {
        timeoutMs: SAGA_DEADLINE_MS
    })
    if (!ok) {
        for (const id of sagaIds) {
            const e = outcomeOf(id)
            console.error(`  - iter=${iteration} saga ${id} outcome=${e ? e.status : 'none'}`)
        }
        throw new Error(`iter ${iteration}: sagas did not reach terminal state`)
    }

    const outcomes = sagaIds.map(outcomeOf)
    const succeeded = outcomes.filter((e) => e.status === 'succeeded').length
    const failed = outcomes.filter((e) => e.status === 'failed').length
    const errored = outcomes.filter((e) => e.status === 'error').length

    if (succeeded !== 1) {
        for (const o of outcomes) console.error(`  - iter=${iteration} ${JSON.stringify(o)}`)
        throw new Error(
            `iter ${iteration}: expected 1 succeeded, got ${succeeded} (failed=${failed}, error=${errored})`
        )
    }
    if (succeeded + failed !== OVERLAP_COUNT) {
        for (const o of outcomes) console.error(`  - iter=${iteration} ${JSON.stringify(o)}`)
        throw new Error(
            `iter ${iteration}: expected ${OVERLAP_COUNT - 1} failed, got ${failed} (error=${errored})`
        )
    }

    return { succeeded, failed }
}

async function main() {
    console.log(`[overlap] server=${SERVER_URL} overlap=${OVERLAP_COUNT} inner=${INNER_ITERATIONS}`)

    const { movieId, theaterId } = await setupFixture()
    const sse = openSseCollector()
    await sse.connected

    // 각 iter는 대략 OVERLAP_COUNT × 10min + 120min 의 timeline을 사용합니다.
    // iter 간격을 12h로 설정해 우승 showtime이 다음 iter와 충돌하지 않게 합니다.
    const spacingMs = 12 * 60 * 60 * 1000

    try {
        for (let i = 1; i <= INNER_ITERATIONS; i++) {
            const result = await runInner(i, movieId, theaterId, sse, i * spacingMs)
            console.log(
                `[overlap] iter ${i}/${INNER_ITERATIONS} OK — 1 succeeded, ${result.failed} failed`
            )
        }
    } finally {
        await sse.close().catch(() => {})
    }

    console.log(`[overlap] PASS: ${INNER_ITERATIONS} iters × ${OVERLAP_COUNT}-way race`)
}

main().catch((err) => {
    console.error('[overlap] error:', err)
    process.exit(1)
})
