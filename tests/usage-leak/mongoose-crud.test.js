// mongoose connection + 단일 model. insert / find 만 N 번.
const mongoose = require('mongoose')
const { probe } = require('./_probe')

const N = parseInt(process.env.LEAK_N ?? '100', 10)

test(`mongoose insert+find × ${N}`, async () => {
    const uri = process.env.MONGO_URI
    if (!uri) throw new Error('MONGO_URI required')

    const conn = mongoose.createConnection(uri, { dbName: 'leak-test' })
    await conn.asPromise()
    const Model = conn.model(
        'leakItem',
        new mongoose.Schema({ name: String, payload: String })
    )
    await Model.deleteMany({})

    probe('mongoose-crud baseline')
    for (let i = 1; i <= N; i++) {
        await Model.create({ name: `n${i}`, payload: 'x'.repeat(1024) })
        await Model.find({}).lean()
        if (i === 1 || i % 20 === 0) probe(`mongoose-crud iter-${i}`)
    }

    await Model.deleteMany({})
    await conn.close()
}, 5 * 60 * 1000)
