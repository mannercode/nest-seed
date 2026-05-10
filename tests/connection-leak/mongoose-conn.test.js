// mongoose.createConnection → close 만 N 번. NestJS @nestjs/mongoose 가
// 매 fixture 마다 새 connection 만드는 패턴 모사.
const mongoose = require('mongoose')
const { probe } = require('./_probe')

const N = parseInt(process.env.LEAK_N ?? '50', 10)

test(`mongoose createConnection/close × ${N}`, async () => {
    const uri = process.env.MONGO_URI
    if (!uri) throw new Error('MONGO_URI required')

    probe('mongoose baseline')
    for (let i = 1; i <= N; i++) {
        const conn = mongoose.createConnection(uri)
        await conn.asPromise()
        await conn.close()
        if (i === 1 || i % 10 === 0) probe(`mongoose iter-${i}`)
    }
}, 5 * 60 * 1000)
