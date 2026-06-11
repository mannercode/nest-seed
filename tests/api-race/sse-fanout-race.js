/**
 * 높은 부하 조건에서 SSE 이벤트가 여러 복제본에 걸쳐 모든 구독자에게 전달되는지 검증하는 부하 테스트이다.
 *
 * 한 회차는 여러 복제본에 SSE 연결을 여러 개 연다.
 * 그다음 시작 시각이 서로 어긋난 사가 생성 요청 여러 건을 동시에 보낸다.
 * 모든 SSE 클라이언트가 모든 사가의 succeeded 이벤트를 받아야 통과이다.
 * 받아야 할 총 이벤트 수는 클라이언트 수와 사가 수의 곱이다.
 *
 * 한 회차는 이벤트 전달을 수천 건씩 일으킨다.
 * 각 사가의 상태 변화(Waiting → Processing → Succeeded)가 NATS로 복제본마다 전달되고,
 * 각 복제본이 내부 Subject를 거쳐 자기 SSE 구독자 전원에게 다시 보내기 때문이다.
 *
 * 어떤 클라이언트가 어떤 사가의 succeeded 이벤트를 놓치거나, SSE 클라이언트들이 한 복제본에만 연결되어 복제본 사이 전달이 검증되지 않으면 실패로 본다.
 */

const {
    readPositiveInt,
    request,
    SERVER_URL,
    openEventStream,
    waitUntil
} = require('./race-common')

const SSE_CLIENT_COUNT = readPositiveInt('SSE_CLIENT_COUNT', 100)
const SAGAS_PER_INNER = readPositiveInt('SAGAS_PER_INNER', 10)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 150)
const DEADLINE_MS = readPositiveInt('SSE_DEADLINE_MS', 300_000)

// 정상 동작이면 모든 data: 프레임은 유효한 JSON이다.
// 파싱 실패는 서버 직렬화나 스트림 손상 같은 실제 결함을 뜻한다.
// 그래서 raw로 삼키지 않고 어떤 페이로드가 깨졌는지 드러내며 즉시 실패시킨다.
function openStrictSseClient(clientId) {
    return openEventStream({
        label: `client ${clientId}`,
        onParseError: (payload, e) => {
            throw new Error(
                `SSE client ${clientId} JSON parse failed: ${e.message} (payload=${payload.slice(0, 100)})`
            )
        }
    })
}

async function setupFixture() {
    const movie = await request('POST', '/movies', {
        body: {
            title: 'stress-movie',
            genres: ['action'],
            releaseDate: '2024-01-01T00:00:00.000Z',
            plot: 'stress plot',
            durationInSeconds: 7200,
            director: 'stress',
            rating: 'PG',
            assetIds: []
        }
    })
    if (movie.status !== 201) throw new Error(`movie create failed: ${movie.status}`)

    const publish = await request('POST', `/movies/${movie.body.id}/publish`)
    if (publish.status !== 200 && publish.status !== 201) {
        throw new Error(`movie publish failed: ${publish.status}`)
    }

    const theater = await request('POST', '/theaters', {
        body: {
            name: 'stress-theater',
            location: { latitude: 37.5665, longitude: 126.978 },
            seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', layout: 'OOOOOOOO' }] }] }
        }
    })
    if (theater.status !== 201) throw new Error(`theater create failed: ${theater.status}`)

    return { movieId: movie.body.id, theaterId: theater.body.id }
}

async function runInner(movieId, theaterId, iteration, baseOffsetMs) {
    // 회차마다 새 SSE 클라이언트 묶음을 연다.
    const clients = Array.from({ length: SSE_CLIENT_COUNT }, (_, i) => openStrictSseClient(i))
    await Promise.all(clients.map((c) => c.connected))

    const replicaSet = new Set(clients.map((c) => c.getReplicaId()).filter(Boolean))
    if (replicaSet.size < 2) {
        await Promise.all(clients.map((c) => c.close().catch(() => {})))
        throw new Error(
            `iter ${iteration}: only 1 replica served SSE (got ${[...replicaSet]}) — cross-replica unverified`
        )
    }

    // SAGAS_PER_INNER개의 saga를 동시에 보낸다.
    // validator가 거부하지 않도록 각각 서로 겹치지 않는 startTime을 사용한다.
    const sagaSpacingMs = 3 * 60 * 60 * 1000 // 3h
    const sagaPromises = Array.from({ length: SAGAS_PER_INNER }, (_, i) => {
        const startTime = new Date(
            Date.now() + 24 * 60 * 60 * 1000 + baseOffsetMs + i * sagaSpacingMs
        )
            .toISOString()
            .replace(/\.\d{3}Z$/, '.000Z')
        return request('POST', '/showtime-creation/showtimes', {
            body: {
                movieId,
                theaterIds: [theaterId],
                durationInMinutes: 120,
                startTimes: [startTime]
            }
        })
    })

    const postResults = await Promise.all(sagaPromises)
    const sagaIds = postResults.map((r) => {
        if (r.status !== 202) throw new Error(`iter ${iteration}: saga POST status ${r.status}`)
        return r.body.sagaId
    })

    // 모든 클라이언트가 모든 사가의 succeeded 이벤트를 받아야 한다.
    const ok = await waitUntil(
        () =>
            clients.every((c) =>
                sagaIds.every((id) =>
                    c.events.some((e) => e && e.sagaId === id && e.status === 'succeeded')
                )
            ),
        { timeoutMs: DEADLINE_MS }
    )

    await Promise.all(clients.map((c) => c.close().catch(() => {})))

    if (!ok) {
        const missing = []
        for (const [clientId, c] of clients.entries()) {
            for (const sagaId of sagaIds) {
                if (!c.events.some((e) => e && e.sagaId === sagaId && e.status === 'succeeded')) {
                    missing.push({ client: clientId, sagaId, replicaId: c.getReplicaId() })
                }
            }
        }
        console.error(
            `[sse] iter=${iteration} ${missing.length} client×saga pairs missed succeeded`
        )
        for (const m of missing.slice(0, 20)) {
            console.error(`  - client ${m.client} saga ${m.sagaId} replica=${m.replicaId}`)
        }
        if (missing.length > 20) console.error(`  ... ${missing.length - 20} more`)
        throw new Error(`iter ${iteration}: ${missing.length} missing events`)
    }

    const totalEvents = SSE_CLIENT_COUNT * SAGAS_PER_INNER
    return { events: totalEvents, replicas: replicaSet.size }
}

async function main() {
    console.log(
        `[sse] server=${SERVER_URL} clients=${SSE_CLIENT_COUNT} sagas=${SAGAS_PER_INNER} inner=${INNER_ITERATIONS}`
    )

    const { movieId, theaterId } = await setupFixture()

    // 각 내부 회차는 baseOffset부터 SAGAS_PER_INNER × 3h 길이의 시간 범위를 사용한다.
    // 회차 사이 간격을 충분히 설정해 서로 충돌하지 않도록 한다.
    const iterSpacingMs = SAGAS_PER_INNER * 3 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000

    for (let i = 1; i <= INNER_ITERATIONS; i++) {
        const result = await runInner(movieId, theaterId, i, i * iterSpacingMs)
        console.log(
            `[sse] iter ${i}/${INNER_ITERATIONS} OK — ${result.events} events delivered, ${result.replicas} replicas`
        )
    }

    console.log(
        `[sse] PASS: ${INNER_ITERATIONS} iters × ${SSE_CLIENT_COUNT} clients × ${SAGAS_PER_INNER} sagas`
    )
}

main().catch((err) => {
    console.error('[sse] error:', err)
    process.exit(1)
})
