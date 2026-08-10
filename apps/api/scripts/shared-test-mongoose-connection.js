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
                return async () => {
                    await Promise.allSettled(
                        Object.values(target.models).map((model) => model.init())
                    )
                    for (const modelName of target.modelNames()) {
                        target.deleteModel(modelName)
                    }
                }
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
