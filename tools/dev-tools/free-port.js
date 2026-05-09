#!/usr/bin/env node
/**
 * TCP 포트를 비운다: 해당 포트에 listen 중인 프로세스를 SIGKILL 한 뒤,
 * 새 listen() 이 실제로 성공할 때까지 polling 한다. 순수 Node + iproute2
 * 의 `ss` 유틸 (Linux dev container 에 항상 존재) 만 사용.
 *
 *   node scripts/free-port.js 3000
 */
const net = require('net')
const { execSync } = require('child_process')

const port = Number(process.argv[2])
if (!port) {
    console.error('usage: free-port.js <port>')
    process.exit(2)
}

function probe(p) {
    return new Promise((resolve) => {
        const srv = net.createServer()
        srv.once('error', () => resolve(false))
        srv.once('listening', () => srv.close(() => resolve(true)))
        srv.listen(p)
    })
}

function findHolders(p) {
    let out = ''
    try {
        out = execSync(`ss -ltnpH 'sport = :${p}'`, {
            stdio: ['ignore', 'pipe', 'ignore']
        }).toString()
    } catch {
        return []
    }
    // ss 가 출력하는 예: `users:(("node",pid=12345,fd=20))`
    const pids = new Set()
    for (const match of out.matchAll(/pid=(\d+)/g)) {
        pids.add(Number(match[1]))
    }
    return [...pids]
}

function killHolders(p) {
    for (const pid of findHolders(p)) {
        try {
            process.kill(pid, 'SIGKILL')
        } catch {
            // 이미 사라짐
        }
    }
}

;(async () => {
    for (let i = 0; i < 25; i++) {
        if (await probe(port)) {
            process.exit(0)
        }
        killHolders(port)
        await new Promise((r) => setTimeout(r, 200))
    }
    console.error(`free-port: :${port} still busy after retries`)
    process.exit(1)
})()
