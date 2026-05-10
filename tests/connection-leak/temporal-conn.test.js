// Temporal NativeConnection 만 connect → close × N. gRPC 채널이 close 후에
// native 메모리 회수되는지.
const { NativeConnection } = require('@temporalio/worker')
const { probe } = require('./_probe')

const N = parseInt(process.env.LEAK_N ?? '50', 10)

test(`Temporal NativeConnection connect/close × ${N}`, async () => {
    const address = process.env.TEMPORAL_HOST_ADDRESS || 'host.docker.internal:7233'

    probe('temporal-conn baseline')
    for (let i = 1; i <= N; i++) {
        const conn = await NativeConnection.connect({ address })
        await conn.close()
        if (i === 1 || i % 10 === 0) probe(`temporal-conn iter-${i}`)
    }
}, 10 * 60 * 1000)
