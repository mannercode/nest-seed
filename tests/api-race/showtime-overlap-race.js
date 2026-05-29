/**
 * 시간이 겹치는 상영 생성 사가들이 동시에 들어왔을 때 분산 락이 한 건만 통과시키는지 검증하는 부하 테스트이다.
 *
 * 한 회차는 사가 요청 여러 건을 한꺼번에 보낸다.
 * 각 요청의 시작 시각을 어긋나게 두면서 길이를 충분히 길게 설정해, 어떤 두 요청을 골라도 시간이 겹치게 만든다.
 * 복제본마다 Temporal 워커가 한 대씩 실행 중이어서 여러 워크플로가 동시에 실행되지만, 검증·삽입 분산 락을 획득한 사가 한 건만 성공한다.
 * 기대 결과는 정확히 한 건이 `succeeded`이고, 나머지는 `failed`이다.
 *
 * 둘 이상이 succeeded이거나, 아무도 성공하지 못하거나, 시간 안에 사가가 종료 상태에 도달하지 못하면 실패로 본다.
 */

const {
    readPositiveInt,
    request,
    SERVER_URL,
    openEventStream,
    waitUntil
} = require('./race-common')

const OVERLAP_COUNT = readPositiveInt('OVERLAP_COUNT', 5)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 300)
const SAGA_DEADLINE_MS = readPositiveInt('SAGA_DEADLINE_MS', 300_000)

// 모든 쌍이 겹치려면 처음/끝 쌍의 겹침 120m - (OVERLAP_COUNT-1)×10m가 양수여야 한다(OVERLAP_COUNT ≤ 12).
// 더 크게 잡으면 일부 쌍이 겹치지 않아 둘 이상이 성공할 수 있고, 그러면 잘못된 전제를 테스트하게 된다.
if (OVERLAP_COUNT > 12) {
    throw new Error(`OVERLAP_COUNT는 12 이하여야 모든 쌍이 겹친다. 받은 값: ${OVERLAP_COUNT}`)
}

async function setupFixture() {
    const movie = await request('POST', '/movies', {
        body: {
            title: 'overlap',
            genres: ['action'],
            releaseDate: '2024-01-01T00:00:00.000Z',
            plot: 'overlap plot',
            durationInSeconds: 7200,
            director: 'overlap',
            rating: 'PG',
            assetIds: []
        }
    })
    if (movie.status !== 201) throw new Error(`movie: ${movie.status}`)

    const publish = await request('POST', `/movies/${movie.body.id}/publish`)
    if (publish.status !== 200 && publish.status !== 201) {
        throw new Error(`publish: ${publish.status}`)
    }

    const theater = await request('POST', '/theaters', {
        body: {
            name: 'overlap',
            location: { latitude: 37.5665, longitude: 126.978 },
            seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', layout: 'OOOOOOOO' }] }] }
        }
    })
    if (theater.status !== 201) throw new Error(`theater: ${theater.status}`)

    return { movieId: movie.body.id, theaterId: theater.body.id }
}

async function runInner(iteration, movieId, theaterId, sse, baseOffsetMs) {
    // collector는 회차 전체에 걸쳐 한 번만 열어 두므로, 직전 회차의 종료된 사가 이벤트가 계속 쌓인다.
    // 회차 시작 시 비워, outcomeOf의 선형 스캔이 회차마다 O(이번 사가 수)로 유지되게 한다.
    // 직전 회차는 모든 사가가 종료 상태에 도달한 뒤에야 끝났으므로 비워도 잃을 정보가 없다.
    sse.events.length = 0

    // N개의 사가를 만들고, startTime은 10분씩 어긋나며 각 길이는 120분이다.
    // 즉 사가들은 base, base+10m, base+20m, ..., base+(N-1)×10m에 위치한다.
    // 마지막 사가는 base + (N-1)×10m + 120m에 끝난다.
    // 모든 쌍이 겹친다.
    // 인접 쌍은 110m 겹치고, 처음/끝 쌍은 120m - (N-1)×10m만큼 겹친다(OVERLAP_COUNT ≤ 12라 양수, 위에서 강제).
    const base = new Date(Date.now() + 24 * 60 * 60 * 1000 + baseOffsetMs)
    base.setUTCSeconds(0, 0)
    base.setUTCMinutes(0)
    const toIso = (d) => d.toISOString().replace(/\.\d{3}Z$/, '.000Z')

    const startTimes = Array.from({ length: OVERLAP_COUNT }, (_, i) =>
        toIso(new Date(base.getTime() + i * 10 * 60 * 1000))
    )

    const posts = await Promise.all(
        startTimes.map((startTime) =>
            request('POST', '/showtime-creation/showtimes', {
                body: {
                    movieId,
                    theaterIds: [theaterId],
                    durationInMinutes: 120,
                    startTimes: [startTime]
                }
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
    const sse = openEventStream()
    await sse.connected

    // 각 회차는 대략 OVERLAP_COUNT × 10min + 120min 길이의 시간 범위를 사용한다.
    // 회차 간격을 12h로 설정해 성공한 상영이 다음 회차와 충돌하지 않게 한다.
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
