#!/usr/bin/env node
/**
 * 개발 서버를 다시 시작하기 전에 TCP 포트를 비우는 도구이다.
 * 해당 포트의 리스너를 SIGKILL로 종료한 뒤, 새 listen()이 성공할 때까지 확인한다.
 * Linux devcontainer에 기본 설치된 `ss`만 사용한다.
 *
 *   node tools/dev-tools/free-port.js 3000
 */
const net = require('net')
const { execFileSync } = require('child_process')

const port = Number(process.argv[2])
if (!port) {
    console.error('usage: free-port.js <port>')
    process.exit(2)
}

function probe(p) {
    return new Promise((resolve, reject) => {
        const srv = net.createServer()
        srv.once('error', (error) => {
            if (error.code === 'EADDRINUSE') resolve(false)
            else reject(error)
        })
        srv.once('listening', () => srv.close(() => resolve(true)))
        srv.listen(p)
    })
}

function findHolders(p) {
    const out = execFileSync('ss', ['-ltnpH', `sport = :${p}`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    })
    // ss가 출력하는 예: `users:(("node",pid=12345,fd=20))`
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
        } catch (error) {
            // 조회 직후 프로세스가 종료된 경우는 무시한다.
            if (error.code !== 'ESRCH') throw error
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
})().catch((error) => {
    console.error(`free-port: ${error.message}`)
    process.exit(1)
})
