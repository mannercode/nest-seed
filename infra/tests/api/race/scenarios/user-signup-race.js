import { test } from 'node:test'
import {
    competingReplicas,
    readPositiveInt,
    request,
    responseDiagnostic,
    secureRandomHex,
    waitForAll
} from '../race-common.js'

const EMAIL_GROUPS = readPositiveInt('RACE_EMAIL_GROUPS', 10)
const CLIENTS_PER_GROUP = readPositiveInt('RACE_CLIENT_COUNT', 50, 2)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 30)

async function verifySignup(email) {
    const body = { name: 'race', birthDate: '1990-01-01', email, password: 'race password 123' }
    const results = await waitForAll(
        Array.from({ length: CLIENTS_PER_GROUP }, () => request('POST', '/users', { body }))
    )
    const created = results.filter((response) => response.status === 201)
    const conflicts = results.filter(
        (response) =>
            response.status === 409 && response.body?.code === 'ERR_USER_EMAIL_ALREADY_EXISTS'
    )
    if (created.length !== 1 || conflicts.length !== CLIENTS_PER_GROUP - 1) {
        const outcomes = results.map(responseDiagnostic)
        throw new Error(
            `email ${email}: expected one 201 and all other emails rejected as duplicates, got ${JSON.stringify(outcomes)}`
        )
    }
    return competingReplicas(results, email)
}

test('같은 이메일로 여러 복제본에서 동시에 가입하면 한 요청만 201을 반환하고 나머지는 중복 이메일로 409를 반환한다', async () => {
    for (let iteration = 1; iteration <= INNER_ITERATIONS; iteration++) {
        const replicas = await waitForAll(
            Array.from({ length: EMAIL_GROUPS }, () =>
                verifySignup(`race.${secureRandomHex()}@example.com`)
            )
        )
        console.log(
            `[signup] ${iteration}/${INNER_ITERATIONS}: ${EMAIL_GROUPS} emails, ${CLIENTS_PER_GROUP} clients per email, min ${Math.min(...replicas)} replicas per email`
        )
    }
})
