/**
 * 겹치되 서로 다른 티켓 묶음을 동시에 구매하는 경쟁을 여러 복제본에 걸쳐 재현하는 부하 테스트이다.
 *
 * purchase의 분산 락 키는 정렬된 티켓 id 묶음이라 "같은 묶음"만 직렬화한다.
 * {t1,t2}와 {t2,t3}처럼 겹치되 다른 묶음은 락 키가 달라 동시에 진행되므로,
 * 이중 판매를 실제로 막는 마지막 가드인 원자 전이(Available→Sold)와
 * 패자의 보상 체인(구매 기록 삭제, 결제 취소)이 경쟁 상태에서 그대로 실행된다.
 * 같은 묶음의 경쟁(락+사전 검사)은 purchase-double-spend.js가 따로 검증한다.
 *
 * 한 회차는 새 상영을 만들고, 사용자 그룹마다 티켓 3장 {t1,t2,t3}를 선점한 뒤
 * {t1,t2}와 {t2,t3} 두 구매를 동시에 보낸다. 그룹마다 정확히 한 건만 성공해야 한다.
 *
 * 성공 응답은 두 가지로 다시 검증한다.
 *  - read-back: `GET /users/me/purchases`에서 이 그룹의 티켓을 담은 구매가 승자 한 건뿐인지.
 *    패자의 구매 기록이 보상으로 삭제됐는지까지 이 검사로 함께 확인된다.
 *  - 티켓 상태: 승자 묶음 2장만 Sold이고, 공유되지 않은 패자의 티켓 1장은 Available로 남았는지.
 *
 * 어떤 그룹의 성공 수가 1이 아니거나, 패자의 흔적(여분 구매 기록, 잘못 팔린 티켓)이 남거나,
 * 5xx가 발생하거나, 응답한 복제본 수가 두 개보다 적으면 실패로 본다.
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
        // 서버가 티켓 수 × TICKET_PRICE(기본 10000)로 합산을 검증한다.
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

    // read-back: 이 그룹의 티켓을 담은 구매 기록이 승자 한 건만 영속됐는지 확인한다.
    // 패자의 구매 기록은 보상(deletePurchaseRecord)이 지웠어야 하므로, 한 건이라도 더 있으면 보상 실패다.
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

    // 티켓 상태: 승자 묶음 2장만 Sold, 공유되지 않은 패자의 티켓 1장은 Available이어야 한다.
    // 패자가 전이를 일부라도 남겼다면(원자성 깨짐) 여기서 드러난다.
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

    // 각 사용자가 자기 그룹의 티켓 3장을 선점한다.
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

    // 모든 그룹이 동시에 겹치는 두 묶음 {t1,t2} / {t2,t3}의 구매를 보낸다.
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
