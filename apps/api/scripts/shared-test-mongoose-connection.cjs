const mongoose = require('mongoose')

const sharedConnectionKey = Symbol.for('nest-seed.shared-test-mongoose-connection')

function attachSharedTestMongooseConnection({ appName, client, dbName }) {
    const connection = mongoose
        .createConnection()
        .setClient(client)
        .useDb(dbName, { useCache: true })
    connection.config.autoCreate = true
    connection.config.autoIndex = true
    connection.config.bufferCommands = true

    const contextConnection = new Proxy(connection, {
        get(target, property) {
            if (property === 'close') {
                // Nest app context는 파일이 공유하는 connection/client를 소유하지 않는다.
                // 모델도 파일 수명 동안 유지해 Mongoose의 memoized Model.init()을 재사용한다.
                // 실제 client 종료는 이를 만든 Vitest afterAll 한 곳에서만 수행한다.
                return async () => undefined
            }

            const value = Reflect.get(target, property, target)
            return typeof value === 'function' ? value.bind(target) : value
        }
    })

    globalThis[sharedConnectionKey] = { appName, connection: contextConnection, dbName }
}

function clearSharedTestMongooseConnection() {
    delete globalThis[sharedConnectionKey]
}

function getSharedTestMongooseConnection() {
    const shared = globalThis[sharedConnectionKey]
    if (!shared) {
        throw new Error('Shared test Mongoose connection is not initialized')
    }
    return shared
}

module.exports = {
    attachSharedTestMongooseConnection,
    clearSharedTestMongooseConnection,
    getSharedTestMongooseConnection
}
