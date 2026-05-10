// NATS 연결 connect → close × N.
const { connect } = require('nats')
const { probe } = require('./_probe')

const N = parseInt(process.env.LEAK_N ?? '50', 10)

test(`NATS connect/close × ${N}`, async () => {
    const servers = (process.env.NATS_SERVERS || '').split(',').filter(Boolean)
    if (servers.length === 0) throw new Error('NATS_SERVERS required')

    probe('nats baseline')
    for (let i = 1; i <= N; i++) {
        const nc = await connect({ servers })
        await nc.close()
        if (i === 1 || i % 10 === 0) probe(`nats iter-${i}`)
    }
}, 5 * 60 * 1000)
