import type { S3Client } from '@aws-sdk/client-s3'
import type { MongoClient } from 'mongodb'

export type WorkerMongoConnection = { client: MongoClient; dbName: string }

export type VitestLifecycleOptions = {
    afterMongoConnect?: (client: MongoClient, dbName: string) => Promise<void> | void
    bucketName: (workerId: string) => string
    connectMongo: (workerId: string) => Promise<WorkerMongoConnection>
    createS3Client: () => S3Client
    onAfterEach?: (testId: string) => Promise<void> | void
    onBeforeEach?: (testId: string) => Promise<void> | void
}

export function setupVitestLifecycle(options: VitestLifecycleOptions): void
