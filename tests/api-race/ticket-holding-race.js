/**
 * 여러 티켓 묶음을 동시에 선점하려는 경쟁을 여러 복제본에 걸쳐 재현하는 부하 테스트이다.
 *
 * 한 회차는 새 상영을 하나 만들고, 거기 들어가는 티켓을 서로 겹치지 않는 쌍 여러 개로 나눈다.
 * 각 쌍마다 같은 사용자 그룹이 동시에 선점을 시도하고, 다른 그룹도 같은 시점에 각자의 쌍으로 요청을 보낸다.
 * 그룹 한 개당 결과는 정확히 한 사용자가 204를 받고, 나머지는 409이다.
 *
 * 사용자 계정은 처음 한 번 만들어 회차 사이에 그대로 다시 사용한다.
 * 이미 선점된 티켓은 같은 락 키로 다시 경쟁시킬 수 없으므로 매 회차마다 새 티켓만 만든다.
 *
 * 어떤 그룹의 204 응답 수가 1이 아니거나, 5xx가 발생하거나, 응답한 복제본 수가 두 개보다 적으면 실패로 본다.
 */

const { readPositiveInt, request, SERVER_URL, waitForSagaSuccess } = require('./race-common')

const TICKET_GROUPS = readPositiveInt('HOLD_TICKET_GROUPS', 5)
const USERS_PER_GROUP = readPositiveInt('HOLD_CLIENT_COUNT', 50)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 200)
const SHOWTIME_DEADLINE_MS = readPositiveInt('SHOWTIME_DEADLINE_MS', 60_000)

const TOTAL_USERS = TICKET_GROUPS * USERS_PER_GROUP

async function setupMovieTheater() {
    const movie = await request('POST', '/movies', {
        body: {
            title: 'hold-race',
            genres: ['action'],
            releaseDate: '2024-01-01T00:00:00.000Z',
            plot: 'plot',
            durationInSeconds: 7200,
            director: 'director',
            rating: 'PG',
            assetIds: []
        }
    })
    if (movie.status !== 201) throw new Error(`movie: ${movie.status}`)

    const publish = await request('POST', `/movies/${movie.body.id}/publish`)
    if (publish.status !== 200 && publish.status !== 201) {
        throw new Error(`publish: ${publish.status}`)
    }

    // 큰 좌석 배치도이다. 1 block × 1 row × 20 tickets라 최대 10개 그룹까지 충분하다.
    const theater = await request('POST', '/theaters', {
        body: {
            name: 'hold-race',
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
    if (tickets.body.length < TICKET_GROUPS * 2) {
        throw new Error(`tickets: need ${TICKET_GROUPS * 2}, got ${tickets.body.length}`)
    }

    // TICKET_GROUPS개의 서로 겹치지 않는 티켓 쌍으로 나눈다.
    const groups = Array.from({ length: TICKET_GROUPS }, (_, g) => [
        tickets.body[g * 2].id,
        tickets.body[g * 2 + 1].id
    ])
    return { showtimeId, groups }
}

async function createAndLoginUser(index) {
    const email = `hold.${Date.now()}.${index}.${Math.random().toString(36).slice(2)}@example.com`
    const password = 'holdpassword'
    const create = await request('POST', '/users', {
        body: { name: `hold-${index}`, birthDate: '1990-01-01T00:00:00.000Z', email, password }
    })
    if (create.status !== 201) throw new Error(`user create ${index}: ${create.status}`)

    const login = await request('POST', '/users/login', { body: { email, password } })
    if (login.status !== 200 && login.status !== 201) {
        throw new Error(`user login ${index}: ${login.status}`)
    }
    return login.body.accessToken
}

async function runInner(iteration, movieId, theaterId, tokens, startTimeOffsetMs) {
    const { showtimeId, groups } = await createShowtimeTickets(
        movieId,
        theaterId,
        startTimeOffsetMs
    )

    // 각 (group, user) 쌍마다 자기 그룹의 티켓 쌍을 선점한다.
    // TICKET_GROUPS × USERS_PER_GROUP개의 요청을 한 Promise.all로 동시에 보낸다.
    const attempts = []
    for (let g = 0; g < TICKET_GROUPS; g++) {
        const ticketIds = groups[g]
        for (let c = 0; c < USERS_PER_GROUP; c++) {
            const token = tokens[g * USERS_PER_GROUP + c]
            attempts.push(
                request('POST', `/booking/showtimes/${showtimeId}/tickets/hold`, {
                    body: { ticketIds },
                    headers: { authorization: `Bearer ${token}` }
                }).then((r) => ({ ...r, group: g }))
            )
        }
    }

    const results = await Promise.all(attempts)

    const byGroup = Array.from({ length: TICKET_GROUPS }, () => ({ ok: 0, conflict: 0, other: [] }))
    const replicaSet = new Set()
    for (const r of results) {
        const g = byGroup[r.group]
        if (r.status === 204) g.ok++
        else if (r.status === 409) g.conflict++
        else g.other.push(r)
        if (r.replicaId) replicaSet.add(r.replicaId)
    }

    for (let g = 0; g < TICKET_GROUPS; g++) {
        const slot = byGroup[g]
        if (slot.ok !== 1) {
            console.error(`[hold] iter=${iteration} group=${g}: expected 1 × 204, got ${slot.ok}`)
            throw new Error(`iter ${iteration} group ${g}: ${slot.ok} × 204`)
        }
        if (slot.other.length > 0) {
            for (const r of slot.other.slice(0, 5)) {
                console.error(
                    `[hold] iter=${iteration} group=${g} unexpected ${r.status} body=${JSON.stringify(r.body)}`
                )
            }
            throw new Error(`iter ${iteration} group ${g}: ${slot.other.length} unexpected`)
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
        `[hold] server=${SERVER_URL} groups=${TICKET_GROUPS} users/group=${USERS_PER_GROUP} inner=${INNER_ITERATIONS}`
    )

    const { movieId, theaterId } = await setupMovieTheater()
    const tokens = await Promise.all(
        Array.from({ length: TOTAL_USERS }, (_, i) => createAndLoginUser(i))
    )

    const spacingMs = 3 * 60 * 60 * 1000

    for (let i = 1; i <= INNER_ITERATIONS; i++) {
        const result = await runInner(i, movieId, theaterId, tokens, i * spacingMs)
        console.log(
            `[hold] iter ${i}/${INNER_ITERATIONS} OK — ${result.total} reqs, ${result.replicas} replicas`
        )
    }

    console.log(
        `[hold] PASS: ${INNER_ITERATIONS} iters × ${TICKET_GROUPS} groups × ${USERS_PER_GROUP} users`
    )
}

main().catch((err) => {
    console.error('[hold] error:', err)
    process.exit(1)
})
