import { test } from 'node:test'
import {
    competingReplicas,
    createAndLoginUser,
    readPositiveInt,
    request,
    responseDiagnostic,
    waitForAll
} from '../race-common.js'

const USER_GROUPS = readPositiveInt('RACE_USER_GROUPS', 5)
const CLIENTS_PER_USER = readPositiveInt('RACE_CLIENT_COUNT', 20, 2)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 30)
const REPLACED_ERROR_CODE = 'ERR_JWT_AUTH_REFRESH_TOKEN_REPLACED'

async function refresh(refreshToken) {
    return request('POST', '/users/refresh', { body: { refreshToken } })
}

async function verifySession(user) {
    const results = await waitForAll(
        Array.from({ length: CLIENTS_PER_USER }, () => refresh(user.refreshToken))
    )
    const winners = results.filter((response) => response.status === 200)
    const conflicts = results.filter(
        (response) => response.status === 409 && response.body?.code === REPLACED_ERROR_CODE
    )
    if (winners.length !== 1 || conflicts.length !== CLIENTS_PER_USER - 1) {
        const outcomes = results.map(responseDiagnostic)
        throw new Error(
            `user ${user.userId}: expected one 200 and all other tokens replaced, got ${JSON.stringify(outcomes)}`
        )
    }
    const replicas = competingReplicas(results, user.userId)
    const nextToken = winners[0].body?.refreshToken
    if (typeof nextToken !== 'string' || !nextToken || nextToken === user.refreshToken) {
        throw new Error(
            `user ${user.userId}: successful rotation on ${winners[0].replicaId} must issue a new refresh token`
        )
    }
    const followup = await refresh(nextToken)
    if (followup.status !== 200)
        throw new Error(
            `user ${user.userId}: next refresh returned ${JSON.stringify(responseDiagnostic(followup))}`
        )
    return replicas
}

test('같은 토큰을 여러 복제본에서 동시에 갱신하면 한 요청만 200을 반환하고 새 토큰으로 다시 갱신할 수 있다', async () => {
    for (let iteration = 1; iteration <= INNER_ITERATIONS; iteration++) {
        const users = await waitForAll(
            Array.from({ length: USER_GROUPS }, (_, index) =>
                createAndLoginUser({ prefix: 'refresh-race', index })
            )
        )
        const replicas = await waitForAll(users.map(verifySession))
        console.log(
            `[refresh] ${iteration}/${INNER_ITERATIONS}: ${users.length} users, ${CLIENTS_PER_USER} clients per user, min ${Math.min(...replicas)} replicas per user`
        )
    }
})
