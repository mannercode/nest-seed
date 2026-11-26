import assert from 'node:assert/strict'
import { once } from 'node:events'
import http from 'node:http'
import { test } from 'node:test'
import { SseDecoder } from '@mannercode/testing'
import {
    SERVER_URL,
    competingReplicas,
    createAndLoginUser,
    readPositiveInt,
    refreshUserAccessTokens,
    request,
    waitForAll,
    waitUntil
} from '#race-common'

const SSE_HANDSHAKE_TIMEOUT_MS = readPositiveInt('SSE_HANDSHAKE_TIMEOUT_MS', 30_000)
const SSE_CLIENT_COUNT = readPositiveInt('SSE_CLIENT_COUNT', 100, 2)
const MESSAGES_PER_INNER = readPositiveInt('MESSAGES_PER_INNER', 10)
const INNER_ITERATIONS = readPositiveInt('INNER_ITERATIONS', 150)
const DEADLINE_MS = readPositiveInt('SSE_DEADLINE_MS', 300_000)

/**
 * `/event-demo/event-stream` SSE 연결 하나를 열고, 도착하는 이벤트를 파싱해 `events`에 쌓는다.
 *
 * @param {object} [opts]
 * @param {string} [opts.serverUrl] 구독할 서버의 주소.
 * @param {string} opts.accessToken 사용자 액세스 토큰.
 * @param {string} [opts.label] 상태 코드·handshake 에러 진단에 붙일 식별자.
 * @param {(err:Error)=>void} opts.onFailure 준비 이후의 연결 종료와 파싱 오류를 시나리오에 전달한다.
 * @returns {{events:any[], connected:Promise<any>, close:()=>Promise<void>, getReplicaId:()=>string|undefined}}
 */
function openEventStream(opts = {}) {
    const { label, onFailure, accessToken, serverUrl = SERVER_URL } = opts
    const url = new URL('/event-demo/event-stream', serverUrl)
    const events = []
    const requestPath = url.pathname + url.search
    const diagnostic = `SSE GET ${requestPath}${label ? ` [${label}]` : ''}`
    let replicaId
    let closed = false
    let req
    let res
    let handshakeSettled = false
    let handshakeDeadline
    let rejectConnected

    const destroy = () => {
        if (handshakeDeadline) clearTimeout(handshakeDeadline)
        if (res && !res.destroyed) res.destroy()
        if (req && !req.destroyed) req.destroy()
    }
    const failHandshake = (error) => {
        if (handshakeSettled) return
        handshakeSettled = true
        destroy()
        rejectConnected(error)
    }
    const failStream = (error) => {
        if (closed) return
        if (!handshakeSettled) return failHandshake(error)
        onFailure(new Error(`${diagnostic}: ${error.message}`, { cause: error }))
    }

    const connected = new Promise((resolve, reject) => {
        rejectConnected = reject
        handshakeDeadline = setTimeout(
            () =>
                failHandshake(
                    new Error(
                        `${diagnostic} handshake timed out after ${SSE_HANDSHAKE_TIMEOUT_MS}ms`
                    )
                ),
            SSE_HANDSHAKE_TIMEOUT_MS
        )

        try {
            req = http.request(
                {
                    agent: false,
                    hostname: url.hostname,
                    port: url.port,
                    path: requestPath,
                    method: 'GET',
                    headers: { accept: 'text/event-stream', authorization: `Bearer ${accessToken}` }
                },
                (incoming) => {
                    if (handshakeSettled) {
                        incoming.destroy()
                        return
                    }
                    res = incoming
                    const contentType = res.headers['content-type']
                        ?.split(';')[0]
                        .trim()
                        .toLowerCase()
                    if (res.statusCode !== 200 || contentType !== 'text/event-stream') {
                        failHandshake(
                            new Error(
                                `${diagnostic}: HTTP ${res.statusCode}, Content-Type ${contentType}`
                            )
                        )
                        return
                    }
                    replicaId = res.headers['x-replica-id']
                    res.setEncoding('utf8')
                    const decoder = new SseDecoder(({ data }) => {
                        if (data !== undefined) events.push(JSON.parse(data))
                    })
                    res.on('data', (chunk) => {
                        if (closed) return
                        try {
                            decoder.write(chunk)
                        } catch (error) {
                            failStream(error)
                        }
                    })
                    res.once('error', failStream)
                    res.once('end', () =>
                        failStream(new Error('stream ended before client closed it'))
                    )
                    handshakeSettled = true
                    clearTimeout(handshakeDeadline)
                    resolve({ res, req })
                }
            )
            req.once('error', failStream)
            req.end()
        } catch (error) {
            failHandshake(error)
        }
    })

    const close = async () => {
        closed = true
        if (!handshakeSettled) {
            failHandshake(new Error(`${diagnostic} closed before handshake completed`))
        }
        try {
            await connected
        } catch {
            // 연결 실패는 connected가 호출자에게 전달한다.
        }
        if (!req || req.closed) return
        const disconnected = new Promise((resolve) => req.once('close', resolve))
        // SSE 응답은 끝나지 않으므로 구독을 TCP reset으로 취소한다.
        // 매 회차 새 구독을 여는 클라이언트가 TIME_WAIT로 임시 포트를 소진하지 않게 한다.
        if (res && !res.complete && !res.destroyed && res.socket && !res.socket.destroyed) {
            res.socket.resetAndDestroy()
        } else {
            req.destroy()
        }
        await disconnected
    }

    return { events, connected, close, getReplicaId: () => replicaId }
}

test('JSON이 여러 data 줄에 나뉘면 한 메시지로 수신한다', async () => {
    await using server = http.createServer((_req, res) => {
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
