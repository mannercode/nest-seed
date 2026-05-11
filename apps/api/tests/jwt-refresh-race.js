// JWT refresh 토큰 회전을 강한 동시 경합 위에서 검증하는 분산 부하 테스트입니다.
//
// `libs/common/src/auth/jwt-auth.service.ts`는 회전과 재사용 탐지를 함께
// 구현합니다. refresh가 성공하면 family 레지스트리에서 쓴 토큰 ID를 지우고
// 새 ID를 발급합니다. 그 뒤로 레지스트리에 없는 ID로 들어오는 refresh는
// family 전체를 무효화합니다.
//
// 안전 조건은 단순합니다. 같은 토큰 하나로 동시에 들어온 refresh 들이 동시에
// 쓸 수 있는 새 토큰을 두 개 이상 만들면 안 됩니다. 결과는 둘 중 하나여야
// 합니다. 한 요청만 통과하고 나머지는 401이거나, 회전 경합이 재사용 탐지를
// 자극해 family 전체가 무효화되거나.
//
// 한 회차는 이렇게 진행됩니다. 사용자 그룹을 여러 개 만들고 각자 로그인합니다. 각
// 사용자의 refresh 토큰 하나에 대해 동시 `/users/refresh` 요청을 복제본
// 여러 대에 걸쳐 보냅니다. 모든 그룹을 같은 시점에 발사해서 nginx가 요청을
// 복제본들에 분산되게 만듭니다.
//
// 그룹마다 다음을 확인합니다.
//   - 200 응답이 최소 한 건 있어야 한다 (회전에 성공한 요청 하나).
//   - 5xx나 예상하지 못한 상태 코드는 한 건도 없어야 합니다.
//   - 새로 받은 토큰 가운데 다시 refresh가 통과하는 토큰은 최대 한 건입니다.
//     둘 이상이 동시에 유효하면 회전 경합이 안전하지 않다는 뜻입니다.
//
// 위 조건을 어기거나, 응답을 처리한 복제본이 하나뿐이라 복제본 사이 분산이
// 확인되지 않으면 테스트를 실패로 봅니다.

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
    // 사용자 그룹 수만큼 사용자를 만듭니다. 각자 새 refresh 토큰을 하나씩 들고
    // 출발합니다.
    const tokens = await Promise.all(
        Array.from({ length: USER_GROUPS }, (_, g) => createAndLogin(`${iteration}-${g}`))
    )

    // 사용자마다 각자의 원래 토큰 하나로 refresh 요청을 한꺼번에 보냅니다. 모든
    // 그룹이 같은 시점에 발사하므로, nginx는 그룹 수 × 사용자당 요청 수
    // 만큼의 동시 요청을 복제본들에 분산해서 받습니다.
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

        // 회전이 안전한지 확인합니다. 새로 받은 토큰 가운데 다시 refresh가
        // 통과하는 토큰은 최대 한 건이어야 합니다. 회전이 정확히 한 토큰만
        // 만들고 나머지는 재사용 탐지로 401이거나, family 전체가
        // 무효화돼 후속 호출이 전부 401이거나 둘 중 하나입니다.
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
