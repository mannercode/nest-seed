// 같은 이메일 가입을 여러 복제본에 동시에 보내 정확히 한 건만 201이 되는지 검증한다.

const { readPositiveInt, request, SERVER_URL } = require('./race-common')

const EMAIL_GROUPS = readPositiveInt('RACE_EMAIL_GROUPS', 10)
const CLIENTS_PER_GROUP = readPositiveInt('RACE_CLIENT_COUNT', 50)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 30)

async function runInner(iteration) {
    const emails = Array.from(
        { length: EMAIL_GROUPS },
        (_, g) =>
            `race.${Date.now()}.${iteration}.${g}.${Math.random().toString(36).slice(2)}@example.com`
    )

    const requests = emails.flatMap((email) =>
        Array.from({ length: CLIENTS_PER_GROUP }, () =>
            request('POST', '/users', {
                body: {
                    name: 'race',
                    birthDate: '1990-01-01T00:00:00.000Z',
                    email,
                    password: 'racepassword'
                }
            }).then((r) => ({ ...r, email }))
        )
    )

    const results = await Promise.all(requests)

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
            const sameEmail = results.filter((r) => r.email === email)
            for (const [idx, r] of sameEmail.entries()) {
                console.error(
                    `  [${idx}] status=${r.status} replica=${r.replicaId} body=${JSON.stringify(r.body).slice(0, 120)}`
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
