// Distributed stress test: JWT refresh-token rotation under heavy
// parallel contention.
//
// libs/common/src/auth/jwt-auth.service.ts implements rotation with
// reuse detection: a successful refresh deletes the consumed tokenId
// from the family registry and issues a new one; any subsequent
// refresh with a tokenId no longer in the registry purges the entire
// family. The race-safety invariant is that concurrent refreshes of
// the same starting token must not produce two simultaneously usable
// next tokens — either one wins and the rest get 401, or the rotation
// race triggers reuse detection and the family is revoked entirely.
//
// Each inner iteration: USER_GROUPS distinct users are created and
// logged in, then each user's single refresh token is hit by
// CLIENTS_PER_USER concurrent /users/refresh requests across replicas.
// All groups fire at once for nginx-level cross-replica spread.
//
// Per-group invariants:
//   - at least 1 × 200 (some refresh winner exists)
//   - 0 × 5xx or any other unexpected status
//   - of the new tokens returned, at most one can refresh again — more
//     than one simultaneously valid means a rotation race window
//
// Fails if any group violates the above, or if responses landed on a
// single replica (cross-replica unverified).

const http = require('http')

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000'
const USER_GROUPS = Number(process.env.RACE_USER_GROUPS || 5)
const CLIENTS_PER_USER = Number(process.env.RACE_CLIENT_COUNT || 20)
const INNER_ITERATIONS = Number(process.env.INNER_ITERATIONS || 30)

function postJson(path, body) {
    const url = new URL(path, SERVER_URL)
    const payload = JSON.stringify(body)
    const agent = new http.Agent({ keepAlive: false })

    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                agent,
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'content-length': Buffer.byteLength(payload)
                }
            },
            (res) => {
                const chunks = []
                res.on('data', (c) => chunks.push(c))
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        replicaId: res.headers['x-replica-id'],
                        body: Buffer.concat(chunks).toString('utf8')
                    })
                    agent.destroy()
                })
            }
        )
        req.on('error', reject)
        req.write(payload)
        req.end()
    })
}

async function createAndLogin(suffix) {
    const email = `race.${Date.now()}.${suffix}.${Math.random().toString(36).slice(2)}@example.com`
    const password = 'racepassword'

    const created = await postJson('/users', {
        name: 'race',
        birthDate: '1990-01-01T00:00:00.000Z',
        email,
        password
    })
    if (created.status !== 201) {
        throw new Error(
            `setup: create user expected 201, got ${created.status} body=${(created.body || '').slice(0, 200)}`
        )
    }

    const loggedIn = await postJson('/users/login', { email, password })
    if (loggedIn.status !== 200) {
        throw new Error(
            `setup: login expected 200, got ${loggedIn.status} body=${(loggedIn.body || '').slice(0, 200)}`
        )
    }

    return JSON.parse(loggedIn.body).refreshToken
}

async function runInner(iteration) {
    // Setup: USER_GROUPS users, each holding a single fresh refresh token.
    const tokens = await Promise.all(
        Array.from({ length: USER_GROUPS }, (_, g) => createAndLogin(`${iteration}-${g}`))
    )

    // Concurrent refresh storm: every user fires CLIENTS_PER_USER refreshes
    // of its single original token. All groups fire together so nginx sees
    // USER_GROUPS × CLIENTS_PER_USER concurrent requests across replicas.
    const requests = tokens.flatMap((token, g) =>
        Array.from({ length: CLIENTS_PER_USER }, () =>
            postJson('/users/refresh', { refreshToken: token }).then((r) => ({ ...r, group: g }))
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
                    `body=${(sample.body || '').slice(0, 120)}`
            )
        }
        if (g.ok.length === 0) {
            throw new Error(
                `iter ${iteration} group ${groupIdx}: 0 × 200 (got ${g.unauthorized} × 401) — ` +
                    `at least one refresh winner expected`
            )
        }

        // Race-safe rotation invariant: of the new tokens emitted, at most
        // one can still refresh — either rotation produced exactly one new
        // token (others got 401 from reuse detection) or the family was
        // purged entirely (followups all 401).
        const newTokens = g.ok.map((r) => JSON.parse(r.body).refreshToken)
        const followups = await Promise.all(
            newTokens.map((t) => postJson('/users/refresh', { refreshToken: t }))
        )
        const stillValid = followups.filter((r) => r.status === 200).length
        if (stillValid > 1) {
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
                    `body=${(sample.body || '').slice(0, 120)}`
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
