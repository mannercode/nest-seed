// 강한 병렬 경합 하에서 user email 유일성의 분산 스트레스 테스트.
//
// 각 inner iteration: EMAIL_GROUPS 개의 서로 다른 email, 각각에 대해
// CLIENTS_PER_GROUP 개의 동시 POST /users 를 보낸다. 모든 group 이 동시에 발사돼
// nginx 가 EMAIL_GROUPS × CLIENTS_PER_GROUP 만큼의 동시 요청을 replica 에 분산
// 한다. group 당: 정확히 1 × 201, 나머지 409, 5xx 없음.
//
// 실패 조건: 어떤 group 이 정확히 1×201 이 아님, 5xx 또는 그 외 예상치 못한
// status, 또는 모든 응답이 하나의 replica 에서만 옴.

const http = require('http')

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000'
const EMAIL_GROUPS = Number(process.env.RACE_EMAIL_GROUPS || 10)
const CLIENTS_PER_GROUP = Number(process.env.RACE_CLIENT_COUNT || 50)
const INNER_ITERATIONS = Number(process.env.INNER_ITERATIONS || 30)

function post(path, body) {
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

async function runInner(iteration) {
    // EMAIL_GROUPS × CLIENTS_PER_GROUP 개의 요청 구성, 동시에 발사한다.
    const emails = Array.from(
        { length: EMAIL_GROUPS },
        (_, g) =>
            `race.${Date.now()}.${iteration}.${g}.${Math.random().toString(36).slice(2)}@example.com`
    )

    const requests = emails.flatMap((email) =>
        Array.from({ length: CLIENTS_PER_GROUP }, () =>
            post('/users', {
                name: 'race',
                birthDate: '1990-01-01T00:00:00.000Z',
                email,
                password: 'racepassword'
            }).then((r) => ({ ...r, email }))
        )
    )

    const results = await Promise.all(requests)

    // email 별로 집계.
    const byEmail = new Map()
    const replicaSet = new Set()
    for (const r of results) {
        const g = byEmail.get(r.email) ?? { created: 0, conflict: 0, other: [] }
        if (r.status === 201) g.created++
        else if (r.status === 409) g.conflict++
        else g.other.push(r)
        byEmail.set(r.email, g)
        if (r.replicaId) replicaSet.add(r.replicaId)
    }

    for (const [email, g] of byEmail) {
        if (g.created !== 1) {
            console.error(
                `[race] iter=${iteration} email=${email}: expected 1 × 201, got ${g.created} (409=${g.conflict}, other=${g.other.length})`
            )
            // 이 email 의 50 개 응답을 전부 덤프해 다음 실패 시 "winner" 가
            // 5xx 를 냈는지, 0 (socket hangup) 을 냈는지, 아니면 예상 못한
            // 상태를 냈는지 알 수 있도록 한다 — 이전 flake 는 다른 진단
            // 정보 없이 0 × 201 만 찍혔다.
            const sameEmail = results.filter((r) => r.email === email)
            for (const [idx, r] of sameEmail.entries()) {
                console.error(
                    `  [${idx}] status=${r.status} replica=${r.replicaId} body=${(r.body || '').slice(0, 120)}`
                )
            }
            throw new Error(`iter ${iteration}: email ${email} had ${g.created} × 201`)
        }
        if (g.other.length > 0) {
            for (const r of g.other.slice(0, 5)) {
                console.error(
                    `[race] iter=${iteration} email=${email} unexpected ${r.status} replica=${r.replicaId}`
                )
            }
            throw new Error(`iter ${iteration}: email ${email} had ${g.other.length} unexpected`)
        }
    }

    if (replicaSet.size < 2) {
        throw new Error(
            `iter ${iteration}: only 1 replica served (got ${[...replicaSet]}) — cross-replica unverified`
        )
    }

    return { groups: EMAIL_GROUPS, total: results.length, replicas: replicaSet.size }
}

async function main() {
    console.log(
        `[race] server=${SERVER_URL} groups=${EMAIL_GROUPS} clients/group=${CLIENTS_PER_GROUP} inner=${INNER_ITERATIONS}`
    )

    for (let i = 1; i <= INNER_ITERATIONS; i++) {
        const result = await runInner(i)
        console.log(
            `[race] iter ${i}/${INNER_ITERATIONS} OK — ${result.groups} groups × ${CLIENTS_PER_GROUP} clients (${result.total} reqs, ${result.replicas} replicas)`
        )
    }

    console.log(
        `[race] PASS: ${INNER_ITERATIONS} iters × ${EMAIL_GROUPS} groups × ${CLIENTS_PER_GROUP} clients`
    )
}

main().catch((err) => {
    console.error('[race] error:', err)
    process.exit(1)
})
