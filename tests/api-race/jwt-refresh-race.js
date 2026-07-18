/**
 * 같은 refresh token을 여러 복제본에서 동시에 회전시킨다.
 * 성공 응답이 만든 토큰 중 다시 회전 가능한 것은 최대 하나여야 하며 5xx는 허용하지 않는다.
 */

const { readPositiveInt, request, SERVER_URL } = require('./race-common')

const USER_GROUPS = readPositiveInt('RACE_USER_GROUPS', 5)
const CLIENTS_PER_USER = readPositiveInt('RACE_CLIENT_COUNT', 20)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 30)

async function createAndLogin(suffix) {
    const email = `race.${Date.now()}.${suffix}.${Math.random().toString(36).slice(2)}@example.com`
    const password = 'racepassword'

    const created = await request('POST', '/users', {
        body: { name: 'race', birthDate: '1990-01-01T00:00:00.000Z', email, password }
    })
    if (created.status !== 201) {
        throw new Error(
            `setup: create user expected 201, got ${created.status} body=${JSON.stringify(created.body).slice(0, 200)}`
        )
    }

    const loggedIn = await request('POST', '/users/login', { body: { email, password } })
    if (loggedIn.status !== 200) {
        throw new Error(
            `setup: login expected 200, got ${loggedIn.status} body=${JSON.stringify(loggedIn.body).slice(0, 200)}`
        )
    }

    return loggedIn.body.refreshToken
}

async function runInner(iteration) {
    const tokens = await Promise.all(
        Array.from({ length: USER_GROUPS }, (_, g) => createAndLogin(`${iteration}-${g}`))
    )

    const requests = tokens.flatMap((token, g) =>
        Array.from({ length: CLIENTS_PER_USER }, () =>
            request('POST', '/users/refresh', { body: { refreshToken: token } }).then((r) => ({
                ...r,
                group: g
            }))
        )
    )

    const results = await Promise.all(requests)

    const replicaSet = new Set()
    const byGroup = new Map()
    for (const r of results) {
        if (r.replicaId) replicaSet.add(r.replicaId)
        const g = byGroup.get(r.group) ?? { ok: [], unauthorized: 0, other: [] }
        if (r.status === 200) g.ok.push(r)
        else if (r.status === 401) g.unauthorized++
        else g.other.push(r)
        byGroup.set(r.group, g)
    }

    for (const [groupIdx, g] of byGroup) {
        if (g.other.length > 0) {
            const sample = g.other[0]
            throw new Error(
                `iter ${iteration} group ${groupIdx}: ${g.other.length} unexpected, ` +
                    `e.g., status=${sample.status} replica=${sample.replicaId} ` +
                    `body=${JSON.stringify(sample.body).slice(0, 120)}`
            )
        }
        if (g.ok.length === 0) {
            throw new Error(
                `iter ${iteration} group ${groupIdx}: 0 × 200 (got ${g.unauthorized} × 401) — ` +
                    `at least one refresh winner expected`
            )
        }

        const newTokens = g.ok.map((r) => r.body.refreshToken)
        const followups = await Promise.all(
            newTokens.map((t) => request('POST', '/users/refresh', { body: { refreshToken: t } }))
        )
        const stillValid = followups.filter((r) => r.status === 200).length
        if (stillValid > 1) {
            // 어떤 후속 회전이 통과했고 어느 복제본이 처리했는지를 남겨,
            // CI 50회 반복에서 한 번 터졌을 때 원인을 분류할 수 있게 한다.
            console.error(
                `[refresh] iter=${iteration} group=${groupIdx}: ` +
                    `winners served by replicas [${g.ok.map((r) => r.replicaId).join(', ')}]`
            )
            followups.forEach((r, i) => {
                console.error(`  - followup[${i}] status=${r.status} replica=${r.replicaId}`)
            })
            throw new Error(
                `iter ${iteration} group ${groupIdx}: ${stillValid} new tokens ` +
                    `simultaneously valid after concurrent refresh — rotation race window`
            )
        }
        const followupOther = followups.filter((r) => r.status !== 200 && r.status !== 401)
        if (followupOther.length > 0) {
            const sample = followupOther[0]
            throw new Error(
                `iter ${iteration} group ${groupIdx}: followup unexpected status=${sample.status} ` +
                    `body=${JSON.stringify(sample.body).slice(0, 120)}`
            )
        }
    }

    if (replicaSet.size < 2) {
        throw new Error(
            `iter ${iteration}: only 1 replica served (got ${[...replicaSet]}) — cross-replica unverified`
        )
    }

    return { groups: USER_GROUPS, total: results.length, replicas: replicaSet.size }
}

async function main() {
    console.log(
        `[race] server=${SERVER_URL} groups=${USER_GROUPS} clients/user=${CLIENTS_PER_USER} inner=${INNER_ITERATIONS}`
    )

    for (let i = 1; i <= INNER_ITERATIONS; i++) {
        const result = await runInner(i)
        console.log(
            `[race] iter ${i}/${INNER_ITERATIONS} OK — ${result.groups} groups × ${CLIENTS_PER_USER} clients (${result.total} reqs, ${result.replicas} replicas)`
        )
    }

    console.log(
        `[race] PASS: ${INNER_ITERATIONS} iters × ${USER_GROUPS} groups × ${CLIENTS_PER_USER} clients`
    )
}

main().catch((err) => {
    console.error('[race] error:', err)
    process.exit(1)
})
