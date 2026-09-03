import 'reflect-metadata'
import { S3Client } from '@aws-sdk/client-s3'
import { setupVitestLifecycle } from '@mannercode/vitest-helpers'
import { MongoClient } from 'mongodb'
import { createRequire } from 'node:module'
import { createMongoDriverOptions } from '../config/mongo-driver-options.js'
import { registerMongoClientDiagnostics } from './support/mongo-client-diagnostics.js'

process.env.LOG_CONSOLE_LEVEL = 'silent'

const require = createRequire(import.meta.url)
const {
    attachSharedTestMongoConnection,
    clearSharedTestMongoConnection
} = require('../../scripts/index.cjs')
const { initializeApiVitestWorkerEnvironment } = require('../../scripts/vitest-resource-wiring.cjs')

// 테스트 파일을 평가하기 전에 실행·worker 범위 자원을 정하고, PROJECT_ID는 아래
// onBeforeEach에서 테스트마다 새로 정한다.
const resourceScope = initializeApiVitestWorkerEnvironment()

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
        attachSharedTestMongoConnection({ client, dbName })
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
    clearSharedTestMongoConnection()
})

function requiredEnvironment(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`Missing required environment variable: ${name}`)
    return value
}
