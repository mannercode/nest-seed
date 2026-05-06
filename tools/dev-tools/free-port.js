#!/usr/bin/env node
/**
 * Frees a TCP port: SIGKILL anything listening on it, then poll until
 * a fresh listen() actually succeeds. Pure Node + the `ss` utility
 * shipped with iproute2 (always present on Linux dev containers).
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
    // ss prints e.g. `users:(("node",pid=12345,fd=20))`
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
            // already gone
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
