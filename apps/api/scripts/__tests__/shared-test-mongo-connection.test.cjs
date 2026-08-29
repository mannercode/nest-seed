const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const connectionModulePath = path.resolve(__dirname, '../shared-test-mongo-connection.cjs')

test('파일 수명의 native client와 database를 그대로 공유하고 직접 닫지 않는다', () => {
    let clearSharedTestMongoConnection
    let closeCalls = 0
    const database = { databaseName: 'mongo-test' }
    const client = {
        close() {
            closeCalls += 1
        },
        db(dbName) {
            assert.equal(dbName, 'mongo-test')
            return database
        }
    }

    try {
        delete require.cache[connectionModulePath]
        const connectionModule = require(connectionModulePath)
        const { attachSharedTestMongoConnection, getSharedTestMongoConnection } = connectionModule
        clearSharedTestMongoConnection = connectionModule.clearSharedTestMongoConnection

        attachSharedTestMongoConnection({ client, dbName: 'mongo-test' })
        const shared = getSharedTestMongoConnection()

        assert.equal(shared.client, client)
        assert.equal(shared.db, database)
        assert.equal(shared.dbName, 'mongo-test')
        assert.equal(closeCalls, 0)

        clearSharedTestMongoConnection()
        assert.equal(closeCalls, 0)
        assert.throws(
            () => getSharedTestMongoConnection(),
            /Shared test Mongo connection is not initialized/
        )
    } finally {
        clearSharedTestMongoConnection?.()
        delete require.cache[connectionModulePath]
    }
})
