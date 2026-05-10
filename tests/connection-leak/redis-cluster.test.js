// ioredis Cluster connect → quit × N.
const Redis = require('ioredis')
const { probe } = require('./_probe')

const N = parseInt(process.env.LEAK_N ?? '50', 10)

test(`ioredis Cluster connect/quit × ${N}`, async () => {
    const nodes = [
        { host: process.env.REDIS_HOST1, port: Number(process.env.REDIS_PORT1) },
        { host: process.env.REDIS_HOST2, port: Number(process.env.REDIS_PORT2) },
        { host: process.env.REDIS_HOST3, port: Number(process.env.REDIS_PORT3) }
    ]

    probe('redis baseline')
    for (let i = 1; i <= N; i++) {
        const c = new Redis.Cluster(nodes, { lazyConnect: false })
        // ioredis 는 비동기 connect. 한 번 ping 해서 연결 확립을 보장.
        await new Promise((resolve, reject) => {
            c.on('ready', resolve)
            c.on('error', reject)
        })
        await c.quit()
        if (i === 1 || i % 10 === 0) probe(`redis iter-${i}`)
    }
}, 10 * 60 * 1000)
