import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { test } from 'node:test'
import {
    competingReplicas,
    createAndLoginUser,
    openEventStream,
    readPositiveInt,
    refreshUserAccessTokens,
    request,
    waitForAll,
    waitUntil
} from '#race-common'

const SSE_CLIENT_COUNT = readPositiveInt('SSE_CLIENT_COUNT', 100, 2)
const MESSAGES_PER_INNER = readPositiveInt('MESSAGES_PER_INNER', 10)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 150)
const DEADLINE_MS = readPositiveInt('SSE_DEADLINE_MS', 300_000)

test('JSON이 여러 data 줄에 나뉘면 한 메시지로 수신한다', async () => {
    await using server = createServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.end(': heartbeat\r\n\r\ndata: {\r\ndata: "id": "one"}\r\n\r\n')
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const disconnected = Promise.withResolvers()
    const client = openEventStream({
        serverUrl: `http://127.0.0.1:${server.address().port}`,
        accessToken: 'fixture',
        onFailure: disconnected.resolve
    })
    try {
        await client.connected
        assert.match((await disconnected.promise).message, /stream ended before client closed it/)
        assert.deepEqual(client.events, [{ id: 'one' }])
    } finally {
        await client.close()
    }
})

async function publish(user, message, signal) {
    const response = await request('POST', '/event-demo/messages', {
        headers: { authorization: `Bearer ${user.accessToken}` },
        body: { message },
        signal
    })
    if (response.status !== 202) throw new Error(`message POST: ${response.status}`)
    const id = response.body?.id
    if (typeof id !== 'string' || !id.trim()) throw new Error('message POST: missing event ID')
    return { id, message }
}

async function waitForDeliveries(clients, expected, signal) {
    const hasEvent = (client, message) =>
        client.events.some((event) => event?.id === message.id && event.message === message.message)
    if (
        await waitUntil(
            () => clients.every((client) => expected.every((message) => hasEvent(client, message))),
            { timeoutMs: DEADLINE_MS, signal }
        )
    )
        return
    const missing = clients.flatMap((client, index) =>
        expected
            .filter((message) => !hasEvent(client, message))
            .map(({ id }) => ({ client: index, replica: client.getReplicaId(), id }))
    )
    throw new Error(`${missing.length} missing deliveries: ${JSON.stringify(missing.slice(0, 20))}`)
}

async function runInner(user, observer, iteration) {
    const failure = new AbortController()
    const open = (account, label) =>
        openEventStream({
            accessToken: account.accessToken,
            label,
            onFailure: (error) => failure.abort(error)
        })
    const clients = Array.from({ length: SSE_CLIENT_COUNT }, (_, i) => open(user, `client ${i}`))
    const other = open(observer, 'observer')
    const all = [...clients, other]
    try {
        await waitForAll(all.map((client) => client.connected))
        const replicas = competingReplicas(
            clients.map((client) => ({ replicaId: client.getReplicaId() })),
            `iteration ${iteration} SSE clients`
        )
        const firstMarker = await publish(observer, `observer ${iteration} start`, failure.signal)
        await waitForDeliveries([other], [firstMarker], failure.signal)
        const sent = await waitForAll(
            Array.from({ length: MESSAGES_PER_INNER }, (_, i) =>
                publish(user, `sender ${iteration}-${i}`, failure.signal)
            )
        )
        if (new Set(sent.map(({ id }) => id)).size !== sent.length)
            throw new Error('distinct messages shared an event ID')
        await waitForDeliveries(clients, sent, failure.signal)
        // 상대 계정의 연결도 정상적으로 소비 중임을 그 계정이 발행한 후속 메시지로 확인한다.
        const marker = await publish(observer, `observer ${iteration}`, failure.signal)
        await waitForDeliveries([other], [marker], failure.signal)
        if (
            other.events.some((event) => !event?.message?.startsWith('observer ')) ||
            clients.some((client) =>
                client.events.some((event) => !event?.message?.startsWith('sender '))
            )
        ) {
            throw new Error(`iteration ${iteration}: SSE connection received another user's event`)
        }
        return replicas
    } catch (error) {
        failure.signal.throwIfAborted()
        throw error
    } finally {
        await waitForAll(all.map((client) => client.close()))
    }
}

test('메시지를 발행하면 여러 복제본에 열린 본인의 SSE 연결이 모두 수신하고 다른 사용자는 자신의 메시지만 받는다', async () => {
    const users = await waitForAll(
        [0, 1].map((index) => createAndLoginUser({ prefix: 'sse-demo', index }))
    )
    for (let iteration = 1; iteration <= INNER_ITERATIONS; iteration++) {
        await refreshUserAccessTokens(users)
        const replicas = await runInner(users[0], users[1], iteration)
        console.log(
            `[sse] ${iteration}/${INNER_ITERATIONS}: ${SSE_CLIENT_COUNT * MESSAGES_PER_INNER} sender deliveries across ${replicas} replicas, observer received its own event`
        )
    }
})
