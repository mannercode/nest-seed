/**
 * 같은 티켓 묶음을 중복 결제하려는 경쟁을 여러 복제본에 걸쳐 재현하는 부하 테스트이다.
 *
 * 한 회차는 새 상영을 하나 만들고, 사용자 그룹마다 서로 겹치지 않는 티켓 쌍 하나씩을 선점한다.
 * 그다음 각 사용자가 각자의 쌍에 대해 결제 요청 여러 건을 동시에 보낸다.
 * 그룹마다 정확히 한 요청만 2xx로 성공하고, 나머지는 4xx(409 AlreadySold 또는 400 NotHeld)이다.
 *
 * 성공 응답은 한 번 더 검증한다. 2xx만으로는 결제가 실제로 영속됐는지 알 수 없으므로,
 * 승자의 구매 기록을 `GET /purchases/:id`로 읽어 들여 결제 하나가 실제로 만들어졌는지 확인한다.
 *
 * 영화, 극장, 사용자 계정은 회차 바깥에서 한 번만 만든다.
 * 매 회차마다 상영, 티켓, 선점, 경쟁만 새로 실행한다.
 *
 * 어떤 그룹의 성공 응답 수가 1이 아니거나, 승자 구매 기록이 영속되지 않았거나,
 * 5xx가 발생하거나, 응답한 복제본 수가 두 개보다 적으면 실패로 본다.
 */

const { readPositiveInt, request, SERVER_URL, waitForSagaSuccess } = require('./race-common')

const USER_GROUPS = readPositiveInt('PURCHASE_USER_GROUPS', 5)
const PURCHASES_PER_GROUP = readPositiveInt('PURCHASE_CLIENT_COUNT', 50)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 150)
const SHOWTIME_DEADLINE_MS = readPositiveInt('SHOWTIME_DEADLINE_MS', 60_000)

async function setupMovieTheater() {
    const movie = await request('POST', '/movies', {
        body: {
            title: 'purchase-race',
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

    // USER_GROUPS만큼 서로 겹치지 않는 티켓 쌍을 만들 수 있도록 큰 좌석 배치도를 쓴다.
    const theater = await request('POST', '/theaters', {
        body: {
            name: 'purchase-race',
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
    const showtime = search.body.find((s) => s.startTime === startTime) ?? search.body.at(-1)
    const showtimeId = showtime.id

    const tickets = await request('GET', `/booking/showtimes/${showtimeId}/tickets`)
    if (tickets.status !== 200 || !Array.isArray(tickets.body)) {
        throw new Error(`tickets: ${tickets.status}`)
    }
    if (tickets.body.length < USER_GROUPS * 2) {
        throw new Error(`tickets: need ${USER_GROUPS * 2}, got ${tickets.body.length}`)
    }

    const groups = Array.from({ length: USER_GROUPS }, (_, g) => [
        tickets.body[g * 2].id,
        tickets.body[g * 2 + 1].id
    ])
    return { showtimeId, groups }
}

async function createAndLoginUser(index) {
    const email = `purchase.${Date.now()}.${index}.${Math.random().toString(36).slice(2)}@example.com`
    const password = 'purchasepass'
    const create = await request('POST', '/users', {
        body: { name: `pur-${index}`, birthDate: '1990-01-01T00:00:00.000Z', email, password }
    })
    if (create.status !== 201) throw new Error(`user create ${index}: ${create.status}`)

    const login = await request('POST', '/users/login', { body: { email, password } })
    if (login.status !== 200 && login.status !== 201) {
        throw new Error(`user login ${index}: ${login.status}`)
    }
    return { userId: create.body.id, accessToken: login.body.accessToken }
}

async function runInner(iteration, movieId, theaterId, users, startTimeOffsetMs) {
    const { showtimeId, groups } = await createShowtimeTickets(
        movieId,
        theaterId,
        startTimeOffsetMs
    )

    // 각 사용자가 자기 그룹의 티켓 쌍을 선점한다.
    await Promise.all(
        users.map(async (cust, g) => {
            const hold = await request('POST', `/booking/showtimes/${showtimeId}/tickets/hold`, {
                body: { ticketIds: groups[g] },
                headers: { authorization: `Bearer ${cust.accessToken}` }
            })
            if (hold.status !== 204) {
                throw new Error(`iter ${iteration} group=${g}: hold status=${hold.status}`)
            }
        })
    )

    // 모든 사용자가 동시에 PURCHASES_PER_GROUP개의 구매 요청을 보낸다.
    const attempts = []
    for (let g = 0; g < USER_GROUPS; g++) {
        const cust = users[g]
        const purchaseItems = groups[g].map((id) => ({ itemId: id, type: 'tickets' }))
        const totalPrice = groups[g].length * 1000
        for (let c = 0; c < PURCHASES_PER_GROUP; c++) {
            attempts.push(
                request('POST', '/purchases', {
                    body: { userId: cust.userId, purchaseItems, totalPrice }
                }).then((r) => ({ ...r, group: g }))
            )
        }
    }

    const results = await Promise.all(attempts)

    const byGroup = Array.from({ length: USER_GROUPS }, () => ({ ok: 0, rejected: 0, other: [] }))
    const replicaSet = new Set()
    for (const r of results) {
        const slot = byGroup[r.group]
        if (r.status >= 200 && r.status < 300) slot.ok++
        else if (r.status >= 400 && r.status < 500) slot.rejected++
        else slot.other.push(r)
        if (r.replicaId) replicaSet.add(r.replicaId)
    }

    for (let g = 0; g < USER_GROUPS; g++) {
        const slot = byGroup[g]
        if (slot.ok !== 1) {
            console.error(
                `[purchase] iter=${iteration} group=${g}: expected 1 × success, got ${slot.ok}`
            )
            for (const r of results.filter(
                (x) => x.group === g && x.status >= 200 && x.status < 300
            )) {
                console.error(
                    `  - ${r.status} replica=${r.replicaId} body=${JSON.stringify(r.body)}`
                )
            }
            throw new Error(`iter ${iteration} group ${g}: ${slot.ok} successes`)
        }
        if (slot.other.length > 0) {
            for (const r of slot.other.slice(0, 5)) {
                console.error(
                    `[purchase] iter=${iteration} group=${g} unexpected ${r.status} body=${JSON.stringify(r.body)}`
                )
            }
            throw new Error(`iter ${iteration} group ${g}: ${slot.other.length} unexpected`)
        }

        // read-back: 승자 구매 기록이 실제로 영속됐는지 확인한다.
        // 2xx 응답 하나만으로는 결제가 만들어졌는지(phantom 성공이 아닌지) 구분하지 못한다.
        const winner = results.find((r) => r.group === g && r.status >= 200 && r.status < 300)
        if (!winner.body || !winner.body.id) {
            throw new Error(`iter ${iteration} group ${g}: success response has no purchase id`)
        }
        const readBack = await request('GET', `/purchases/${winner.body.id}`)
        if (readBack.status !== 200 || readBack.body?.id !== winner.body.id) {
            throw new Error(
                `iter ${iteration} group ${g}: purchase ${winner.body.id} not persisted ` +
                    `(read-back status=${readBack.status})`
            )
        }
        if (readBack.body.paymentId !== winner.body.paymentId) {
            throw new Error(
                `iter ${iteration} group ${g}: persisted paymentId ${readBack.body.paymentId} ` +
                    `!= response ${winner.body.paymentId}`
            )
        }
    }

    if (replicaSet.size < 2) {
        throw new Error(
            `iter ${iteration}: only 1 replica (got ${[...replicaSet]}) — cross-replica unverified`
        )
    }

    return { total: results.length, replicas: replicaSet.size }
}

async function main() {
    console.log(
        `[purchase] server=${SERVER_URL} groups=${USER_GROUPS} purchases/group=${PURCHASES_PER_GROUP} inner=${INNER_ITERATIONS}`
    )

    const { movieId, theaterId } = await setupMovieTheater()
    const users = await Promise.all(
        Array.from({ length: USER_GROUPS }, (_, i) => createAndLoginUser(i))
    )

    const spacingMs = 3 * 60 * 60 * 1000

    for (let i = 1; i <= INNER_ITERATIONS; i++) {
        const result = await runInner(i, movieId, theaterId, users, i * spacingMs)
        console.log(
            `[purchase] iter ${i}/${INNER_ITERATIONS} OK — ${result.total} reqs, ${result.replicas} replicas`
        )
    }

    console.log(
        `[purchase] PASS: ${INNER_ITERATIONS} iters × ${USER_GROUPS} groups × ${PURCHASES_PER_GROUP} purchases`
    )
}

main().catch((err) => {
    console.error('[purchase] error:', err)
    process.exit(1)
})
