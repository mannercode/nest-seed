// 같은 티켓 쌍을 여러 복제본에서 동시에 선점해 그룹마다 한 건만 204가 되는지 검증한다.

const {
    createAndLoginUser,
    createPublishedMovieAndTheater,
    createShowtimeWithTickets,
    readPositiveInt,
    request,
    SERVER_URL
} = require('./race-common')

const TICKET_GROUPS = readPositiveInt('HOLD_TICKET_GROUPS', 5)
const USERS_PER_GROUP = readPositiveInt('HOLD_CLIENT_COUNT', 50)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 200)
const SHOWTIME_DEADLINE_MS = readPositiveInt('SHOWTIME_DEADLINE_MS', 60_000)

const TOTAL_USERS = TICKET_GROUPS * USERS_PER_GROUP

async function runInner(iteration, movieId, theaterId, tokens, startTimeOffsetMs) {
    const { showtimeId, ticketIds } = await createShowtimeWithTickets({
        movieId,
        theaterId,
        startTimeOffsetMs,
        minimumTicketCount: TICKET_GROUPS * 2,
        deadlineMs: SHOWTIME_DEADLINE_MS
    })
    const groups = Array.from({ length: TICKET_GROUPS }, (_, group) =>
        ticketIds.slice(group * 2, group * 2 + 2)
    )

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
            // 이중 204가 같은 복제본에서 났는지(프로세스 안의 경쟁)·다른 복제본인지(Redis 가드 깨짐)를
            // 구분할 수 있게 그룹 전체 응답을 남긴다.
            for (const r of results.filter((x) => x.group === g)) {
                console.error(
                    `  - ${r.status} replica=${r.replicaId} body=${JSON.stringify(r.body)}`
                )
            }
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

    const { movieId, theaterId } = await createPublishedMovieAndTheater({
        label: 'hold-race',
        seatCount: 20
    })
    const tokens = await Promise.all(
        Array.from({ length: TOTAL_USERS }, async (_, index) => {
            const user = await createAndLoginUser({ prefix: 'hold', index })
            return user.accessToken
        })
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
