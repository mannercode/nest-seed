/**
 * 복제본 스택에 같은 티켓 묶음의 구매를 동시에 보내 그룹마다 한 건만 성공하는지 검증한다.
 * 성공한 구매와 paymentId를 구매 목록에서 다시 읽는다. 결제 collection의 개수를 세지는 않는다.
 */

const { test } = require('node:test')
const {
    createAndLoginUser,
    createPublishedMovieAndTheater,
    createShowtimeWithTickets,
    isPurchaseConflict,
    readPositiveInt,
    refreshAdminAccessToken,
    refreshUserAccessTokens,
    request,
    secureRandomHex,
    SERVER_URL
} = require('./race-common')

const USER_GROUPS = readPositiveInt('PURCHASE_USER_GROUPS', 5)
const PURCHASES_PER_GROUP = readPositiveInt('PURCHASE_CLIENT_COUNT', 50)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 30)
const SHOWTIME_DEADLINE_MS = readPositiveInt('SHOWTIME_DEADLINE_MS', 60_000)

async function runInner(iteration, movieId, theaterId, users, startTimeOffsetMs) {
    const { showtimeId, ticketIds } = await createShowtimeWithTickets({
        movieId,
        theaterId,
        startTimeOffsetMs,
        minimumTicketCount: USER_GROUPS * 2,
        deadlineMs: SHOWTIME_DEADLINE_MS
    })
    const groups = Array.from({ length: USER_GROUPS }, (_, group) =>
        ticketIds.slice(group * 2, group * 2 + 2)
    )

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

    const attempts = []
    for (let g = 0; g < USER_GROUPS; g++) {
        const cust = users[g]
        const purchaseItems = groups[g].map((id) => ({ itemId: id, type: 'tickets' }))
        const totalPrice = groups[g].length * 10000
        for (let c = 0; c < PURCHASES_PER_GROUP; c++) {
            attempts.push(
                request('POST', '/purchases', {
                    body: { purchaseItems, totalPrice },
                    headers: {
                        authorization: `Bearer ${cust.accessToken}`,
                        'idempotency-key': secureRandomHex()
                    }
                }).then((r) => ({ ...r, group: g }))
            )
        }
    }

    const results = await Promise.all(attempts)

    const byGroup = Array.from({ length: USER_GROUPS }, () => ({ ok: 0, rejected: 0, other: [] }))
    const replicaSet = new Set()
    for (const r of results) {
        const slot = byGroup[r.group]
        if (r.status === 201) slot.ok++
        else if (isPurchaseConflict(r)) slot.rejected++
        else slot.other.push(r)
        if (r.replicaId) replicaSet.add(r.replicaId)
    }

    for (let g = 0; g < USER_GROUPS; g++) {
        const slot = byGroup[g]
        if (slot.ok !== 1) {
            console.error(
                `[purchase] iter=${iteration} group=${g}: expected 1 × success, got ${slot.ok}`
            )
            for (const r of results.filter((x) => x.group === g && x.status === 201)) {
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

        const winner = results.find((r) => r.group === g && r.status === 201)
        if (!winner.body || !winner.body.id) {
            throw new Error(`iter ${iteration} group ${g}: success response has no purchase id`)
        }
        const cust = users[g]
        const readBack = await request('GET', '/users/me/purchases', {
            headers: { authorization: `Bearer ${cust.accessToken}` }
        })
        if (readBack.status !== 200 || !Array.isArray(readBack.body)) {
            throw new Error(
                `iter ${iteration} group ${g}: purchases read-back status=${readBack.status}`
            )
        }
        const persisted = readBack.body.find((p) => p.id === winner.body.id)
        if (!persisted) {
            throw new Error(
                `iter ${iteration} group ${g}: purchase ${winner.body.id} not persisted ` +
                    `(not in GET /users/me/purchases)`
            )
        }
        if (persisted.paymentId !== winner.body.paymentId) {
            throw new Error(
                `iter ${iteration} group ${g}: persisted paymentId ${persisted.paymentId} ` +
                    `!= response ${winner.body.paymentId}`
            )
        }
    }

    // 복제본 분산은 충돌 키별이 아니라 이번 회차 전체의 응답에서 확인한다.
    if (replicaSet.size < 2) {
        throw new Error(
            `iter ${iteration}: only 1 replica (got ${[...replicaSet]}) — cross-replica unverified`
        )
    }

    return { total: results.length, replicas: replicaSet.size }
}

test('같은 티켓 묶음의 동시 구매는 하나만 성공하고 그 결과를 이력에서 다시 읽는다', async () => {
    console.log(
        `[purchase] server=${SERVER_URL} groups=${USER_GROUPS} purchases/group=${PURCHASES_PER_GROUP} inner=${INNER_ITERATIONS}`
    )

    const { movieId, theaterId } = await createPublishedMovieAndTheater({
        label: 'purchase-race',
        seatCount: 20
    })
    const users = await Promise.all(
        Array.from({ length: USER_GROUPS }, (_, index) =>
            createAndLoginUser({ prefix: 'purchase', index })
        )
    )

    const spacingMs = 3 * 60 * 60 * 1000

    for (let i = 1; i <= INNER_ITERATIONS; i++) {
        // 전체 반복은 토큰 수명을 넘을 수 있으므로 경합 전에 인증 fixture를 갱신한다.
        await refreshAdminAccessToken()
        await refreshUserAccessTokens(users)
        const result = await runInner(i, movieId, theaterId, users, i * spacingMs)
        console.log(
            `[purchase] iter ${i}/${INNER_ITERATIONS} OK — ${result.total} reqs, ${result.replicas} replicas`
        )
    }

    console.log(
        `[purchase] PASS: ${INNER_ITERATIONS} iters × ${USER_GROUPS} groups × ${PURCHASES_PER_GROUP} purchases`
    )
})
