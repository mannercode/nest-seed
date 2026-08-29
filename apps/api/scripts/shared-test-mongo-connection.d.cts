import type { Db, MongoClient } from 'mongodb'

type SharedTestMongoConnection = { client: MongoClient; db: Db; dbName: string }

export function attachSharedTestMongoConnection(options: {
    client: MongoClient
    dbName: string
}): void
export function clearSharedTestMongoConnection(): void
export function getSharedTestMongoConnection(): SharedTestMongoConnection
