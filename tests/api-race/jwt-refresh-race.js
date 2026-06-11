/**
 * JWT 리프레시 토큰 회전을 높은 동시성 조건에서 검증하는 분산 부하 테스트이다.
 *
 * `libs/common/src/auth/jwt-auth.service.ts`는 회전과 재사용 탐지를 함께 구현한다.
 * 리프레시가 성공하면 토큰 묶음 레지스트리에서 쓴 토큰 ID를 지우고 새 ID를 발급한다.
 * 그 뒤로 레지스트리에 없는 ID로 들어오는 리프레시는 토큰 묶음 전체를 무효화한다.
 *
 * 안전 조건은 단순하다.
 * 같은 토큰 하나로 동시에 들어온 리프레시 요청들이 동시에 쓸 수 있는 새 토큰을 두 개 이상 만들면 안 된다.
 * 결과는 둘 중 하나여야 한다.
 * 한 요청만 통과하고 나머지는 401이거나, 회전 경합이 재사용 탐지를 자극해 토큰 묶음 전체가 무효화되어야 한다.
 *
 * 한 회차는 사용자 그룹을 여러 개 만들고 각자 로그인한 뒤, 각 사용자의 리프레시 토큰 하나에 대해 동시 `/users/refresh` 요청을 복제본 여러 대에 걸쳐 보낸다.
 * 모든 그룹을 같은 시점에 보내 NGINX가 요청을 복제본들에 분산하게 만든다.
 *
 * 그룹마다 다음을 확인한다.
 * - 200 응답이 최소 한 건 있어야 한다(회전에 성공한 요청 하나).
 * - 5xx나 예상하지 못한 상태 코드는 한 건도 없어야 한다.
 * - 새로 받은 토큰 가운데 다시 리프레시가 통과하는 토큰은 최대 한 건이다.
 *   둘 이상이 동시에 유효하면 회전 경합이 안전하지 않다는 뜻이다.
 *
 * 위 조건을 어기거나, 응답을 처리한 복제본이 하나뿐이라 복제본 사이 분산이 확인되지 않으면 테스트를 실패로 본다.
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
    // 사용자 그룹 수만큼 사용자를 만든다.
    // 각자 새 리프레시 토큰을 하나씩 들고 출발한다.
    const tokens = await Promise.all(
        Array.from({ length: USER_GROUPS }, (_, g) => createAndLogin(`${iteration}-${g}`))
    )

    // 사용자마다 각자의 원래 토큰 하나로 리프레시 요청을 한꺼번에 보낸다.
    // 모든 그룹이 같은 시점에 보내지므로, NGINX는 그룹 수 × 사용자당 요청 수 만큼의 동시 요청을 복제본들에 분산해서 받는다.
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

        // 회전이 안전한지 확인한다.
        // 새로 받은 토큰 가운데 다시 리프레시가 통과하는 토큰은 최대 한 건이어야 한다.
        // 회전이 정확히 한 토큰만 만들고 나머지는 재사용 탐지로 401이거나, 토큰 묶음 전체가 무효화돼 후속 호출이 전부 401이거나 둘 중 하나이다.
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
