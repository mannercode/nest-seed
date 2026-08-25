const assert = require('node:assert/strict')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')

const connectionModulePath = path.resolve(__dirname, '../shared-test-mongoose-connection.js')

test('Nest context close는 파일 소유 connection과 이미 초기화된 모델을 유지한다', async () => {
    const originalLoad = Module._load
    const client = { name: 'shared-client' }
    const movieModel = { name: 'Movie' }
    let clearSharedTestMongooseConnection
    let underlyingCloseCalls = 0
    let deleteModelCalls = 0

    const connection = {
        config: {},
        models: { Movie: movieModel },
        close: async () => {
            underlyingCloseCalls += 1
        },
        deleteModel: () => {
            deleteModelCalls += 1
        },
        owner() {
            return this
        }
    }
    const connectionBuilder = {
        setClient(receivedClient) {
            assert.equal(receivedClient, client)
            return this
        },
        useDb(dbName, options) {
            assert.equal(dbName, 'mongo-test')
            assert.deepEqual(options, { useCache: true })
            return connection
        }
    }

    Module._load = function loadWithMongooseMocked(request, parent, isMain) {
        if (parent?.filename === connectionModulePath && request === 'mongoose') {
            return { createConnection: () => connectionBuilder }
        }
        return Reflect.apply(originalLoad, this, [request, parent, isMain])
    }

    try {
        delete require.cache[connectionModulePath]
        const connectionModule = require(connectionModulePath)
        const { attachSharedTestMongooseConnection, getSharedTestMongooseConnection } =
            connectionModule
        clearSharedTestMongooseConnection = connectionModule.clearSharedTestMongooseConnection

        attachSharedTestMongooseConnection({ appName: 'test-app', client, dbName: 'mongo-test' })
        const shared = getSharedTestMongooseConnection()

        await shared.connection.close()
        await shared.connection.close()

        assert.equal(shared.connection.models.Movie, movieModel)
        assert.equal(shared.connection.owner(), connection)
        assert.equal(underlyingCloseCalls, 0)
        assert.equal(deleteModelCalls, 0)

        clearSharedTestMongooseConnection()
        assert.throws(
            () => getSharedTestMongooseConnection(),
            /Shared test Mongoose connection is not initialized/
        )
    } finally {
        clearSharedTestMongooseConnection?.()
        Module._load = originalLoad
        delete require.cache[connectionModulePath]
    }
})
