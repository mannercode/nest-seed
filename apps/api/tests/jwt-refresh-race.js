// JWT refresh-token rotation 의 분산 스트레스 테스트. 강한 병렬 경합 하에서 동작 검증.
//
// libs/common/src/auth/jwt-auth.service.ts 는 reuse detection 과 함께 rotation 을
// 구현한다: refresh 성공 시 family registry 에서 소비된 tokenId 를 지우고 새 tokenId 를
// 발급한다. 이후 registry 에 없는 tokenId 로 들어오는 refresh 요청은 family 전체를
// purge 한다. race-safety invariant 는, 같은 시작 token 으로 동시에 들어온 refresh 들이
// 동시에 사용 가능한 next token 을 두 개 이상 만들어서는 안 된다는 것이다. 하나만
// 이기고 나머지는 401, 아니면 rotation race 가 reuse detection 을 트리거해 family 가
// 통째로 revoke 되거나 둘 중 하나여야 한다.
//
// 각 inner iteration: USER_GROUPS 만큼의 유저를 만들고 로그인한 뒤, 각 유저의 단일
// refresh token 에 대해 CLIENTS_PER_USER 개의 동시 /users/refresh 요청을 replica 들에
// 걸쳐 보낸다. 모든 group 이 동시에 발사되어 nginx 레벨에서 cross-replica 분산이
// 발생하도록 한다.
//
// group 별 invariant:
//   - 최소 1 × 200 (refresh winner 가 적어도 하나 존재)
//   - 5xx 나 그 외 예상치 못한 status 는 0
//   - 새로 받은 token 들 중 다시 refresh 가능한 token 은 최대 하나여야 한다. 두 개
//     이상 동시 유효하면 rotation race window 가 발생한 것이다.
//
// 위 invariant 를 위반하거나, 응답이 단일 replica 에서만 처리됐다면 (cross-replica 미검증)
// 실패 처리한다.

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
    // Setup: USER_GROUPS 명의 유저, 각각 새 refresh token 하나씩 보유.
    const tokens = await Promise.all(
        Array.from({ length: USER_GROUPS }, (_, g) => createAndLogin(`${iteration}-${g}`))
    )

    // 동시 refresh 폭주: 각 유저가 자기 single original token 으로 CLIENTS_PER_USER
    // 번의 refresh 를 발사한다. 모든 group 이 동시에 발사돼 nginx 가
    // USER_GROUPS × CLIENTS_PER_USER 만큼의 동시 요청을 replica 들에 분산해서 받는다.
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

        // Race-safe rotation invariant: 새로 발급된 token 들 중 다시 refresh 가
        // 가능한 token 은 최대 하나여야 한다. rotation 이 정확히 하나의 새 token 만
        // 생성했거나 (나머지는 reuse detection 으로 401), family 가 통째로 purge 돼
        // followup 이 모두 401 이거나 둘 중 하나다.
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
