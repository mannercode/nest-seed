/**
 * 같은 refresh token을 여러 복제본에서 동시에 회전시킨다.
 * 정확히 하나만 성공하고 나머지는 동시 회전 충돌이어야 하며,
 * 승자의 새 refresh token은 다시 회전돼 토큰 패밀리가 폐기되지 않았음을 증명해야 한다.
 */

const { readPositiveInt, request, secureRandomHex, SERVER_URL } = require('./race-common')

const USER_GROUPS = readPositiveInt('RACE_USER_GROUPS', 5)
const CLIENTS_PER_USER = readPositiveInt('RACE_CLIENT_COUNT', 20)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 30)
const CONCURRENT_ERROR_CODE = 'ERR_JWT_AUTH_REFRESH_TOKEN_CONCURRENT'

async function createAndLogin(suffix) {
    const email = `race.${Date.now()}.${suffix}.${secureRandomHex()}@example.com`
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
        const g = byGroup.get(r.group) ?? { ok: [], concurrent: [], unauthorized: [], other: [] }
        if (r.status === 200) g.ok.push(r)
        else if (r.status === 409 && r.body?.code === CONCURRENT_ERROR_CODE) {
            g.concurrent.push(r)
        } else if (r.status === 401) g.unauthorized.push(r)
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
        if (g.ok.length !== 1 || g.concurrent.length !== CLIENTS_PER_USER - 1) {
            throw new Error(
                `iter ${iteration} group ${groupIdx}: expected 1 × 200 and ` +
                    `${CLIENTS_PER_USER - 1} × 409/${CONCURRENT_ERROR_CODE}, got ` +
                    `${g.ok.length} × 200, ${g.concurrent.length} × concurrent 409, ` +
                    `${g.unauthorized.length} × 401`
            )
        }

        const winner = g.ok[0]
        const winnerToken = winner.body?.refreshToken
        if (typeof winnerToken !== 'string' || winnerToken.length === 0) {
            throw new Error(
                `iter ${iteration} group ${groupIdx}: winner from replica=${winner.replicaId} ` +
                    `did not return a refresh token, body=${JSON.stringify(winner.body).slice(0, 120)}`
            )
        }

        const followup = await request('POST', '/users/refresh', {
            body: { refreshToken: winnerToken }
        })
        if (followup.status !== 200) {
            throw new Error(
                `iter ${iteration} group ${groupIdx}: winner token followup expected 200, ` +
                    `got status=${followup.status} replica=${followup.replicaId} ` +
                    `body=${JSON.stringify(followup.body).slice(0, 120)} — token family was revoked`
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
