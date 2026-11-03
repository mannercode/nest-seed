// 같은 사용자의 SSE 연결을 여러 복제본에 열고 모든 발행 메시지가 도착하는지 검증한다.
const { test } = require('node:test')
const {
    createAndLoginUser,
    refreshUserAccessTokens,
    readPositiveInt,
    request,
    SERVER_URL,
    openEventStream,
    waitUntil
} = require('./race-common')

const SSE_CLIENT_COUNT = readPositiveInt('SSE_CLIENT_COUNT', 100)
const MESSAGES_PER_INNER = readPositiveInt('MESSAGES_PER_INNER', 10)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 150)
const DEADLINE_MS = readPositiveInt('SSE_DEADLINE_MS', 300_000)

async function runInner(user, iteration) {
    const clients = Array.from({ length: SSE_CLIENT_COUNT }, (_, i) =>
        openEventStream({
            accessToken: user.accessToken,
            label: `client ${i}`,
            onParseError: (payload, error) => {
                throw new Error(
                    `SSE client ${i}: ${error.message} (payload=${payload.slice(0, 100)})`
                )
            }
        })
    )
    try {
        await Promise.all(clients.map((client) => client.connected))
        const replicas = new Set(clients.map((client) => client.getReplicaId()).filter(Boolean))
        if (replicas.size < 2)
            throw new Error(
                `iter ${iteration}: cross-replica delivery unverified (${[...replicas]})`
            )
        const sent = await Promise.all(
            Array.from({ length: MESSAGES_PER_INNER }, async (_, i) => {
                const message = `message ${iteration}-${i}`
                const response = await request('POST', '/event-demo/messages', {
                    headers: { authorization: `Bearer ${user.accessToken}` },
                    body: { message }
                })
                if (response.status !== 202) throw new Error(`message POST: ${response.status}`)
                return { id: response.body.id, message }
            })
        )
        const delivered = (client, message) =>
            client.events.some(
                (event) => event.id === message.id && event.message === message.message
            )
        if (
            !(await waitUntil(
                () =>
                    clients.every((client) => sent.every((message) => delivered(client, message))),
                { timeoutMs: DEADLINE_MS }
            ))
        ) {
            const missing = clients.flatMap((client, index) =>
                sent
                    .filter((message) => !delivered(client, message))
                    .map((message) => ({
                        client: index,
                        replica: client.getReplicaId(),
                        id: message.id
                    }))
            )
            throw new Error(
                `iter ${iteration}: ${missing.length} missing deliveries: ${JSON.stringify(missing.slice(0, 20))}`
            )
        }
        return { events: SSE_CLIENT_COUNT * MESSAGES_PER_INNER, replicas: replicas.size }
    } finally {
        await Promise.all(clients.map((client) => client.close()))
    }
}

test('여러 복제본의 SSE 연결 모두에 사용자가 발행한 메시지가 전달된다', async () => {
    console.log(
        `[sse] server=${SERVER_URL} clients=${SSE_CLIENT_COUNT} messages=${MESSAGES_PER_INNER} inner=${INNER_ITERATIONS}`
    )
    const user = await createAndLoginUser({ prefix: 'sse-demo', index: 0 })
    for (let iteration = 1; iteration <= INNER_ITERATIONS; iteration++) {
        await refreshUserAccessTokens([user])
        const result = await runInner(user, iteration)
        console.log(
            `[sse] ${iteration}/${INNER_ITERATIONS}: ${result.events} deliveries, ${result.replicas} replicas`
        )
    }
})
