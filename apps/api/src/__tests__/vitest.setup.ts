import 'reflect-metadata'
import { S3Client } from '@aws-sdk/client-s3'
import { setupVitestLifecycle } from '@mannercode/vitest-helpers'
import { MongoClient } from 'mongodb'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
    attachSharedTestMongooseConnection,
    clearSharedTestMongooseConnection
} = require('../../scripts/index.cjs')
const { initializeApiVitestWorkerEnvironment } = require('../../scripts/vitest-resource-wiring.cjs')

// app 모듈이 PROJECT_ID를 최초 평가하기 전에 공유 .env 값을 실행별 namespace로 덮어쓴다.
const resourceScope = initializeApiVitestWorkerEnvironment()

const { createMongoDriverOptions } = await import('../config/mongo-driver-options.js')
const { registerMongoClientDiagnostics } = await import('../modules/mongoose-setup.module.js')

const sharedMongoAppName = () =>
    `nest-seed-test-w${process.env.VITEST_POOL_ID ?? '0'}-p${process.pid}-shared`

setupVitestLifecycle({
    connectMongo: async (workerId) => {
        const dbName = resourceScope.databaseName(workerId)
        process.env.MONGO_DATABASE = dbName

        const client = new MongoClient(
            requiredEnvironment('MONGO_URI'),
            createMongoDriverOptions({ appName: sharedMongoAppName(), lifetime: 'test-file' })
        )
        registerMongoClientDiagnostics(client, dbName, sharedMongoAppName())
        await client.connect()
        return { client, dbName }
    },
    afterMongoConnect: (client, dbName) => {
        attachSharedTestMongooseConnection({ appName: sharedMongoAppName(), client, dbName })
    },
    createS3Client: () =>
        new S3Client({
            endpoint: requiredEnvironment('S3_ENDPOINT'),
            region: requiredEnvironment('S3_REGION'),
            credentials: {
                accessKeyId: requiredEnvironment('S3_ACCESS_KEY'),
                secretAccessKey: requiredEnvironment('S3_SECRET_KEY')
            },
            forcePathStyle: requiredEnvironment('S3_FORCE_PATH_STYLE').toLowerCase() === 'true'
        }),
    bucketName: (workerId) => {
        const bucket = resourceScope.bucketName(workerId)
        process.env.S3_BUCKET = bucket
        return bucket
    },
    onBeforeEach: (testId) => {
        process.env.PROJECT_ID = resourceScope.projectId(testId)
    }
})

afterAll(() => {
    clearSharedTestMongooseConnection()
})

function requiredEnvironment(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`Missing required environment variable: ${name}`)
    return value
}
