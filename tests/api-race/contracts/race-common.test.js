const assert = require('node:assert/strict')
const http = require('node:http')
const { after, afterEach, before, test } = require('node:test')

const DEADLINE_MS = 100
const OUTER_WATCHDOG_MS = 2_000

let common
let server
const sockets = new Set()
const responseIntervals = new Set()
const originalEnv = new Map()
let announceBodyStallReached
let announceHandshakeStallReached
let sseMode = 'stall'
const bodyStallReached = new Promise((resolve) => (announceBodyStallReached = resolve))
const handshakeStallReached = new Promise((resolve) => (announceHandshakeStallReached = resolve))

function overrideEnv(name, value) {
    originalEnv.set(name, process.env[name])
    process.env[name] = value
}

function destroyServerSockets() {
    for (const socket of sockets) socket.destroy()
}

function clearResponseIntervals() {
    for (const interval of responseIntervals) clearInterval(interval)
    responseIntervals.clear()
}

async function waitUntil(predicate, timeoutMs = 500) {
    const deadline = Date.now() + timeoutMs
    while (!predicate() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 10))
    }
    return predicate()
}

async function withinOuterWatchdog(promise, label) {
    let timer
    const watchdog = new Promise((_, reject) => {
        timer = setTimeout(
            () => reject(new Error(`test watchdog: ${label} did not settle by itself`)),
            OUTER_WATCHDOG_MS
        )
    })
    try {
        return await Promise.race([promise, watchdog])
    } finally {
        clearTimeout(timer)
    }
}

before(async () => {
    server = http.createServer((req, res) => {
        if (req.url === '/ok') {
            res.writeHead(200, {
                'content-type': 'application/json',
                'x-replica-id': 'local-replica'
            })
            res.end(JSON.stringify({ ok: true }))
            return
        }

        if (req.url?.startsWith('/body-stall')) {
            announceBodyStallReached()
            res.writeHead(200, { 'content-type': 'application/json' })
            res.write('{"partial":')
            // 계속 데이터가 와도 요청 시작 기준의 절대 deadline은 끝나야 한다.
            // 소켓 inactivity timeout만 구현하면 이 테스트를 통과하지 못한다.
            const interval = setInterval(() => res.write(' '), 10)
            responseIntervals.add(interval)
            res.once('close', () => {
                clearInterval(interval)
                responseIntervals.delete(interval)
            })
            return
        }

        // SSE handshake stall: 요청은 받되 응답 헤더를 전혀 보내지 않는다.
        if (req.url === '/showtime-creation/event-stream') {
            if (sseMode === 'open') {
                res.writeHead(200, {
                    'content-type': 'text/event-stream',
                    'x-replica-id': 'sse-replica'
                })
                res.write('data: {"status":"ready"}\n\n')
                return
            }
            announceHandshakeStallReached()
            return
        }

        res.writeHead(404).end()
    })
    server.on('connection', (socket) => {
        sockets.add(socket)
        socket.once('close', () => sockets.delete(socket))
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

    const address = server.address()
    assert.notEqual(address, null)
    assert.equal(typeof address, 'object')
    overrideEnv('SERVER_URL', `http://127.0.0.1:${address.port}`)
    overrideEnv('HTTP_REQUEST_TIMEOUT_MS', String(DEADLINE_MS))
    overrideEnv('SSE_HANDSHAKE_TIMEOUT_MS', String(DEADLINE_MS))

    const modulePath = require.resolve('../race-common')
    delete require.cache[modulePath]
    common = require(modulePath)
})

afterEach(async () => {
    destroyServerSockets()
    clearResponseIntervals()
    await new Promise((resolve) => setImmediate(resolve))
})

after(async () => {
    destroyServerSockets()
    clearResponseIntervals()
    await new Promise((resolve) => server.close(resolve))
    delete require.cache[require.resolve('../race-common')]
    for (const [name, value] of originalEnv) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
    }
})

test('HTTP request는 응답 body가 끝나지 않아도 전체 deadline에 method/path 진단과 함께 실패한다', async () => {
    const rejection = assert.rejects(
        withinOuterWatchdog(
            common.request('POST', '/body-stall?case=whole-response', { body: { value: 1 } }),
            'HTTP response body stall'
        ),
        (error) => {
            assert.match(error.message, /HTTP POST \/body-stall\?case=whole-response/)
            assert.match(error.message, /timed out/i)
            assert.match(error.message, new RegExp(`${DEADLINE_MS}ms`))
            return true
        }
    )
    await withinOuterWatchdog(bodyStallReached, 'HTTP request did not reach the stall route')
    await rejection

    assert.equal(await waitUntil(() => sockets.size === 0), true)
})

test('HTTP request는 deadline 전에 끝난 응답을 기존 형식으로 반환하고 연결을 정리한다', async () => {
    await assert.doesNotReject(async () => {
        assert.deepEqual(await common.request('GET', '/ok'), {
            status: 200,
            replicaId: 'local-replica',
            body: { ok: true }
        })
    })
    assert.equal(await waitUntil(() => sockets.size === 0), true)
})

test('SSE는 응답 헤더가 멈추면 handshake deadline에 method/path/label 진단과 함께 실패한다', async () => {
    const stream = common.openEventStream({ label: 'stall-client' })
    try {
        const rejection = assert.rejects(
            withinOuterWatchdog(stream.connected, 'SSE handshake stall'),
            (error) => {
                assert.match(error.message, /SSE GET \/showtime-creation\/event-stream/)
                assert.match(error.message, /stall-client/)
                assert.match(error.message, /handshake timed out/i)
                assert.match(error.message, new RegExp(`${DEADLINE_MS}ms`))
                return true
            }
        )
        await withinOuterWatchdog(
            handshakeStallReached,
            'SSE request did not reach the handshake stall route'
        )
        await rejection

        assert.equal(await waitUntil(() => sockets.size === 0), true)
    } finally {
        // RED 구현에서는 자체 deadline이 없어 connected가 pending이므로 먼저 서버 socket을 끊는다.
        destroyServerSockets()
        await stream.close()
    }
})

test('SSE handshake가 끝나면 deadline을 해제하고 기존 event parsing/close 계약을 유지한다', async () => {
    sseMode = 'open'
    const stream = common.openEventStream({ label: 'healthy-client' })
    await stream.connected

    assert.equal(await waitUntil(() => stream.events.length === 1), true)
    assert.deepEqual(stream.events, [{ status: 'ready' }])
    assert.equal(stream.getReplicaId(), 'sse-replica')

    await stream.close()
    assert.equal(await waitUntil(() => sockets.size === 0), true)
})
