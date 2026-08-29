const sharedConnectionKey = Symbol.for('nest-seed.shared-test-mongo-connection')

function attachSharedTestMongoConnection({ client, dbName }) {
    globalThis[sharedConnectionKey] = { client, db: client.db(dbName), dbName }
}

function clearSharedTestMongoConnection() {
    delete globalThis[sharedConnectionKey]
}

function getSharedTestMongoConnection() {
    const shared = globalThis[sharedConnectionKey]
    if (!shared) {
        throw new Error('Shared test Mongo connection is not initialized')
    }
    return shared
}

module.exports = {
    attachSharedTestMongoConnection,
    clearSharedTestMongoConnection,
    getSharedTestMongoConnection
}
