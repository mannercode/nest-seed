// 같은 티켓 묶음을 중복 결제하려는 경쟁을 복제본 너머로 재현하는 부하
// 테스트입니다.
//
// 한 회차는 이렇게 진행됩니다. 새 상영을 하나 만들고, 사용자 그룹마다 서로
// 겹치지 않는 티켓 쌍 하나씩을 hold 합니다. 그 다음 각 사용자가 각자의 쌍에
// 대해 결제 요청 여러 건을 동시에 발사합니다. 그룹 한 개당 결과는 정확히
// 하나가 2xx로 성공하고, 나머지는 4xx (409 AlreadySold 또는 400
// NotHeld)입니다.
//
// 영화, 극장, 사용자 계정은 회차 바깥에서 한 번만 만듭니다. 매 회차마다
// 상영, 티켓, hold, 경쟁만 새로 실행합니다.
//
// 다음 중 하나라도 해당하면 실패로 봅니다. 어떤 그룹의 성공 응답 수가
// 1이 아니거나, 5xx가 발생하거나, 응답을 한 복제본 수가 둘보다 적은
// 경우.

const http = require('http')

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000'
const USER_GROUPS = Number(process.env.PURCHASE_USER_GROUPS || 5)
const PURCHASES_PER_GROUP = Number(process.env.PURCHASE_CLIENT_COUNT || 50)
const INNER_ITERATIONS = Number(process.env.INNER_ITERATIONS || 150)
const SHOWTIME_DEADLINE_MS = Number(process.env.SHOWTIME_DEADLINE_MS || 60_000)

function requestRaw(method, path, { body, headers } = {}) {
    const url = new URL(path, SERVER_URL)
    const payload = body === undefined ? undefined : JSON.stringify(body)
    const agent = new http.Agent({ keepAlive: false })
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                agent,
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method,
                headers: {
                    'content-type': 'application/json',
                    ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
                    ...(headers || {})
                }
            },
            (res) => {
                const chunks = []
                res.on('data', (c) => chunks.push(c))
                res.on('end', () => {
                    const raw = Buffer.concat(chunks).toString('utf8')
                    let parsed = null
                    try {
                        parsed = raw ? JSON.parse(raw) : null
                    } catch {
                        parsed = raw
                    }
                    resolve({
                        status: res.statusCode,
                        body: parsed,
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

function waitForSagaSuccess(sagaId) {
    const url = new URL('/showtime-creation/event-stream', SERVER_URL)
    const agent = new http.Agent({ keepAlive: false })
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            agent.destroy()
            reject(new Error(`saga ${sagaId} did not finish in ${SHOWTIME_DEADLINE_MS}ms`))
        }, SHOWTIME_DEADLINE_MS)

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
                let buffer = ''
                res.setEncoding('utf8')
                res.on('data', (chunk) => {
                    buffer += chunk
                    let idx
                    while ((idx = buffer.indexOf('\n\n')) !== -1) {
                        const frame = buffer.slice(0, idx)
                        buffer = buffer.slice(idx + 2)
                        const dataLine = frame.split('\n').find((line) => line.startsWith('data:'))
                        if (!dataLine) continue
                        try {
                            const event = JSON.parse(dataLine.slice('data:'.length).trim())
                            if (event.sagaId !== sagaId) continue
                            if (event.status === 'succeeded') {
                                clearTimeout(timer)
                                res.destroy()
                                agent.destroy()
                                resolve()
                                return
                            }
                            if (event.status === 'failed' || event.status === 'error') {
                                clearTimeout(timer)
                                res.destroy()
                                agent.destroy()
                                reject(new Error(`saga ${sagaId} status=${event.status}`))
                                return
                            }
                        } catch {
                            /* 무시 */
                        }
                    }
                })
                res.on('error', reject)
            }
        )
        req.on('error', reject)
        req.end()
    })
}

async function setupMovieTheater() {
    const movie = await requestRaw('POST', '/movies', {
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

    const publish = await requestRaw('POST', `/movies/${movie.body.id}/publish`)
    if (publish.status !== 200 && publish.status !== 201) {
        throw new Error(`publish: ${publish.status}`)
    }

    // USER_GROUPS만큼의 disjoint ticket pair를 잘라낼 수 있도록 큰 seatmap.
    const theater = await requestRaw('POST', '/theaters', {
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
    const created = await requestRaw('POST', '/showtime-creation/showtimes', {
        body: { movieId, theaterIds: [theaterId], durationInMinutes: 120, startTimes: [startTime] }
    })
    if (created.status !== 202) throw new Error(`showtime: ${created.status}`)
    await waitForSagaSuccess(created.body.sagaId)

    const search = await requestRaw('POST', '/showtime-creation/showtimes/search', {
        body: { theaterIds: [theaterId] }
    })
    if (search.status !== 200 || !Array.isArray(search.body) || search.body.length === 0) {
        throw new Error(`showtimes search: ${search.status}`)
    }
    const showtime = search.body.find((s) => s.startTime === startTime) ?? search.body.at(-1)
    const showtimeId = showtime.id

    const tickets = await requestRaw('GET', `/booking/showtimes/${showtimeId}/tickets`)
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
    const create = await requestRaw('POST', '/users', {
        body: { name: `pur-${index}`, birthDate: '1990-01-01T00:00:00.000Z', email, password }
    })
    if (create.status !== 201) throw new Error(`user create ${index}: ${create.status}`)

    const login = await requestRaw('POST', '/users/login', { body: { email, password } })
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

    // 각 유저가 각자의 group의 ticket pair를 hold.
    await Promise.all(
        users.map(async (cust, g) => {
            const hold = await requestRaw('POST', `/booking/showtimes/${showtimeId}/tickets/hold`, {
                body: { ticketIds: groups[g] },
                headers: { authorization: `Bearer ${cust.accessToken}` }
            })
            if (hold.status !== 204) {
                throw new Error(`iter ${iteration} group=${g}: hold status=${hold.status}`)
            }
        })
    )

    // 모든 유저가 동시에 PURCHASES_PER_GROUP 개의 purchase를 발사합니다.
    const attempts = []
    for (let g = 0; g < USER_GROUPS; g++) {
        const cust = users[g]
        const purchaseItems = groups[g].map((id) => ({ itemId: id, type: 'tickets' }))
        const totalPrice = groups[g].length * 1000
        for (let c = 0; c < PURCHASES_PER_GROUP; c++) {
            attempts.push(
                requestRaw('POST', '/purchases', {
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
