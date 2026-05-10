// MongoClient (mongodb 드라이버) connect → close 만 N 번 반복.
// 사용 안 하고 연결/해제만 했을 때 메모리 누수가 있는지.
const { MongoClient } = require('mongodb')
const { probe } = require('./_probe')

const N = parseInt(process.env.LEAK_N ?? '50', 10)

test(`MongoClient connect/close × ${N}`, async () => {
    const uri = process.env.MONGO_URI
    if (!uri) throw new Error('MONGO_URI required')

    probe('mongo baseline')
    for (let i = 1; i <= N; i++) {
        const client = new MongoClient(uri)
        await client.connect()
        await client.close()
        if (i === 1 || i % 10 === 0) probe(`mongo iter-${i}`)
    }
}, 5 * 60 * 1000)
