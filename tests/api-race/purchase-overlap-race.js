/**
 * 락 키가 다른 {t1,t2}/{t2,t3} 구매를 동시에 보내 원자 전이와 패자 보상을 검증한다.
 * 그룹마다 구매 기록 한 건과 Sold 티켓 두 장만 남아야 한다.
 */

const { readPositiveInt, request, SERVER_URL, waitForSagaSuccess } = require('./race-common')

const USER_GROUPS = readPositiveInt('PURCHASE_USER_GROUPS', 5)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 150)
const SHOWTIME_DEADLINE_MS = readPositiveInt('SHOWTIME_DEADLINE_MS', 60_000)

async function setupMovieTheater() {
    const movie = await request('POST', '/movies', {
        body: {
            title: 'purchase-overlap-race',
            genres: ['action'],
            releaseDate: '2024-01-01T00:00:00.000Z',
            plot: 'plot',
            durationInSeconds: 7200,
            director: 'dir',
            rating: 'PG',
            assetIds: []
        }
    })
    if (movie.status !== 201) throw new Error(`movie: ${movie.status}`)

    const publish = await request('POST', `/movies/${movie.body.id}/publish`)
    if (publish.status !== 200 && publish.status !== 201) {
        throw new Error(`publish: ${publish.status}`)
    }

    // USER_GROUPS만큼 서로 겹치지 않는 티켓 3장 묶음을 만들 수 있도록 큰 좌석 배치도를 쓴다.
    const theater = await request('POST', '/theaters', {
        body: {
            name: 'purchase-overlap-race',
            location: { latitude: 37.5665, longitude: 126.978 },
            seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', layout: 'O'.repeat(20) }] }] }
        }
    })
    if (theater.status !== 201) throw new Error(`theater: ${theater.status}`)

    return { movieId: movie.body.id, theaterId: theater.body.id }
}

async function createShowtimeTickets(movieId, theaterId, startTimeOffsetMs) {
    const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000 + startTimeOffsetMs)
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z')
    const created = await request('POST', '/showtime-creation/showtimes', {
        body: { movieId, theaterIds: [theaterId], durationInMinutes: 120, startTimes: [startTime] }
    })
    if (created.status !== 202) throw new Error(`showtime: ${created.status}`)
    await waitForSagaSuccess(created.body.sagaId, SHOWTIME_DEADLINE_MS)

    const search = await request('POST', '/showtime-creation/showtimes/search', {
        body: { theaterIds: [theaterId] }
    })
    if (search.status !== 200 || !Array.isArray(search.body) || search.body.length === 0) {
        throw new Error(`showtimes search: ${search.status}`)
    }
    const showtime = search.body.find((s) => s.startTime === startTime)
    if (!showtime) {
        throw new Error(`showtimes search: no showtime with startTime ${startTime}`)
    }
    const showtimeId = showtime.id

    const tickets = await request('GET', `/booking/showtimes/${showtimeId}/tickets`)
    if (tickets.status !== 200 || !Array.isArray(tickets.body)) {
        throw new Error(`tickets: ${tickets.status}`)
    }
    if (tickets.body.length < USER_GROUPS * 3) {
        throw new Error(`tickets: need ${USER_GROUPS * 3}, got ${tickets.body.length}`)
    }

    const triples = Array.from({ length: USER_GROUPS }, (_, g) => [
        tickets.body[g * 3].id,
        tickets.body[g * 3 + 1].id,
        tickets.body[g * 3 + 2].id
    ])
    return { showtimeId, triples }
}

async function createAndLoginUser(index) {
    const email = `overlap.${Date.now()}.${index}.${Math.random().toString(36).slice(2)}@example.com`
    const password = 'overlappass'
    const create = await request('POST', '/users', {
        body: { name: `ovl-${index}`, birthDate: '1990-01-01T00:00:00.000Z', email, password }
    })
    if (create.status !== 201) throw new Error(`user create ${index}: ${create.status}`)

    const login = await request('POST', '/users/login', { body: { email, password } })
    if (login.status !== 200 && login.status !== 201) {
        throw new Error(`user login ${index}: ${login.status}`)
    }
    return { userId: create.body.id, accessToken: login.body.accessToken }
}

function toPurchaseBody(ticketIds) {
    return {
        purchaseItems: ticketIds.map((id) => ({ itemId: id, type: 'tickets' })),
        totalPrice: ticketIds.length * 10000
    }
}

async function verifyGroup(iteration, g, cust, triple, responses, showtimeId) {
    const ok = responses.filter((r) => r.status >= 200 && r.status < 300)
    const rejected = responses.filter((r) => r.status >= 400 && r.status < 500)
    const other = responses.filter(
        (r) => r.status < 200 || (r.status >= 300 && r.status < 400) || r.status >= 500
    )

    if (ok.length !== 1 || other.length > 0) {
        console.error(
            `[overlap] iter=${iteration} group=${g}: expected 1 × success + 1 × 4xx, ` +
                `got ok=${ok.length} rejected=${rejected.length} other=${other.length}`
        )
        for (const r of responses) {
            console.error(
                `  - bundle=${r.bundle} ${r.status} replica=${r.replicaId} ` +
                    `body=${JSON.stringify(r.body).slice(0, 200)}`
            )
        }
        throw new Error(
            `iter ${iteration} group ${g}: ok=${ok.length} other=${other.length} (want 1/0)`
        )
    }

    const winner = ok[0]
    if (!winner.body || !winner.body.id) {
        throw new Error(`iter ${iteration} group ${g}: success response has no purchase id`)
    }

    const readBack = await request('GET', '/users/me/purchases', {
        headers: { authorization: `Bearer ${cust.accessToken}` }
    })
    if (readBack.status !== 200 || !Array.isArray(readBack.body)) {
        throw new Error(
            `iter ${iteration} group ${g}: purchases read-back status=${readBack.status}`
        )
    }
    const tripleSet = new Set(triple)
    const touching = readBack.body.filter((p) =>
        p.purchaseItems.some((item) => tripleSet.has(item.itemId))
    )
    if (touching.length !== 1 || touching[0].id !== winner.body.id) {
        throw new Error(
            `iter ${iteration} group ${g}: expected only winner ${winner.body.id} persisted, ` +
                `got [${touching.map((p) => p.id).join(', ')}]`
        )
    }

    const tickets = await request('GET', `/booking/showtimes/${showtimeId}/tickets`)
    if (tickets.status !== 200 || !Array.isArray(tickets.body)) {
        throw new Error(`iter ${iteration} group ${g}: tickets read-back status=${tickets.status}`)
    }
    const statusById = new Map(tickets.body.map((t) => [t.id, t.status]))
    const winnerIds = new Set(winner.body.purchaseItems.map((item) => item.itemId))
    for (const ticketId of triple) {
        const expected = winnerIds.has(ticketId) ? 'sold' : 'available'
        const actual = statusById.get(ticketId)
        if (actual !== expected) {
            throw new Error(
                `iter ${iteration} group ${g}: ticket ${ticketId} status=${actual}, ` +
                    `expected ${expected} (winner bundle=[${[...winnerIds].join(', ')}])`
            )
        }
    }
}

async function runInner(iteration, movieId, theaterId, users, startTimeOffsetMs) {
    const { showtimeId, triples } = await createShowtimeTickets(
        movieId,
        theaterId,
        startTimeOffsetMs
    )

    await Promise.all(
        users.map(async (cust, g) => {
            const hold = await request('POST', `/booking/showtimes/${showtimeId}/tickets/hold`, {
                body: { ticketIds: triples[g] },
                headers: { authorization: `Bearer ${cust.accessToken}` }
            })
            if (hold.status !== 204) {
                throw new Error(`iter ${iteration} group=${g}: hold status=${hold.status}`)
            }
        })
    )

    const attempts = []
    for (let g = 0; g < USER_GROUPS; g++) {
        const cust = users[g]
        const [t1, t2, t3] = triples[g]
        for (const bundle of [
            [t1, t2],
            [t2, t3]
        ]) {
            attempts.push(
                request('POST', '/purchases', {
                    body: toPurchaseBody(bundle),
                    headers: { authorization: `Bearer ${cust.accessToken}` }
                }).then((r) => ({ ...r, group: g, bundle: bundle.join('+') }))
            )
        }
    }

    const results = await Promise.all(attempts)

    const replicaSet = new Set()
    for (const r of results) {
        if (r.replicaId) replicaSet.add(r.replicaId)
    }

    for (let g = 0; g < USER_GROUPS; g++) {
        const responses = results.filter((r) => r.group === g)
        await verifyGroup(iteration, g, users[g], triples[g], responses, showtimeId)
    }

    if (replicaSet.size < 2) {
        throw new Error(
            `iter ${iteration}: only 1 replica (got ${[...replicaSet]}) — cross-replica unverified`
        )
    }

    return { total: results.length, replicas: replicaSet.size }
}

async function main() {
    console.log(`[overlap] server=${SERVER_URL} groups=${USER_GROUPS} inner=${INNER_ITERATIONS}`)

    const { movieId, theaterId } = await setupMovieTheater()
    const users = await Promise.all(
        Array.from({ length: USER_GROUPS }, (_, i) => createAndLoginUser(i))
    )

    const spacingMs = 3 * 60 * 60 * 1000

    for (let i = 1; i <= INNER_ITERATIONS; i++) {
        const result = await runInner(i, movieId, theaterId, users, i * spacingMs)
        console.log(
            `[overlap] iter ${i}/${INNER_ITERATIONS} OK — ${result.total} reqs, ${result.replicas} replicas`
        )
    }

    console.log(`[overlap] PASS: ${INNER_ITERATIONS} iters × ${USER_GROUPS} groups × 2 purchases`)
}

main().catch((err) => {
    console.error('[overlap] error:', err)
    process.exit(1)
})
