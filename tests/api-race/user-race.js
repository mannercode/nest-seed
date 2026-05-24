/**
 * 높은 동시성 조건에서 사용자 이메일 유일성이 깨지지 않는지 검증하는 부하 테스트이다.
 *
 * 한 회차는 서로 다른 이메일 여러 개를 준비하고, 각 이메일마다 동일한 가입 요청을 한꺼번에 보낸다.
 * 모든 그룹을 같은 시점에 보내 NGINX가 요청을 여러 복제본으로 분산하게 한다.
 * 그룹 한 개당 결과는 정확히 한 요청만 201이고 나머지는 409이다.
 * 5xx는 한 건도 없어야 한다.
 *
 * 어떤 그룹의 201 응답 수가 1이 아니거나, 5xx나 예상하지 못한 상태 코드가 나오거나, 모든 응답이 한 복제본에서만 오면 실패로 본다.
 */

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
                    ...(process.env.ADMIN_ACCESS_TOKEN
                        ? { authorization: `Bearer ${process.env.ADMIN_ACCESS_TOKEN}` }
                        : {}),
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
    // EMAIL_GROUPS × CLIENTS_PER_GROUP개의 요청을 구성해 동시에 보낸다.
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

    // 이메일별로 집계한다.
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
            // 이 이메일의 응답 전체를 남겨 다음 실패 때 성공 후보가 5xx였는지, 소켓이 끊겼는지, 예상하지 못한 상태였는지 구분한다.
            // 이전에는 일시 실패가 나도 진단 정보 없이 0 x 201만 출력했다.
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
