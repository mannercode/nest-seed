import type { Db, MongoClient } from 'mongodb'

const sharedConnectionKey = Symbol.for('nest-seed.shared-test-mongo-connection')
const worker = globalThis as typeof globalThis & {
    [sharedConnectionKey]?: { client: MongoClient; db: Db }
}

export function attachSharedTestMongoConnection(client: MongoClient, dbName: string) {
    worker[sharedConnectionKey] = { client, db: client.db(dbName) }
}

export function clearSharedTestMongoConnection() {
    delete worker[sharedConnectionKey]
}

export function getSharedTestMongoConnection() {
    const connection = worker[sharedConnectionKey]
    if (!connection) throw new Error('Shared test Mongo connection is not initialized')
    return connection
}
