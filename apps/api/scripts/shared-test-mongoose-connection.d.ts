import type { MongoClient } from 'mongodb'
import type { Connection } from 'mongoose'

type SharedTestMongooseConnection = { appName: string; connection: Connection; dbName: string }

export function attachSharedTestMongooseConnection(options: {
    appName: string
    client: MongoClient
    dbName: string
}): void
export function clearSharedTestMongooseConnection(): void
export function getSharedTestMongooseConnection(): SharedTestMongooseConnection
