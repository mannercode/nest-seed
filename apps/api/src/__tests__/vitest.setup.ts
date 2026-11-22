import 'reflect-metadata'
import { S3Client } from '@aws-sdk/client-s3'
import { setupVitestLifecycle } from '@mannercode/vitest-helpers'
import { MongoClient } from 'mongodb'
import { createRequire } from 'node:module'
import { createMongoDriverOptions } from '@mannercode/common'
import {
    attachSharedTestMongoConnection,
    clearSharedTestMongoConnection
} from './helpers/shared-mongo-connection.js'

const resources = createRequire(import.meta.url)('./vitest.resources.cjs')

process.env.LOG_CONSOLE_LEVEL = 'silent'
process.env.RESTATE_SERVICE_PORT = '0'

// 테스트 파일을 읽기 전에 worker의 초기값을 설정하고, 테스트마다 PROJECT_ID를 바꾼다.
process.env.TEST_ID = `startup-w${process.env.VITEST_POOL_ID ?? '1'}`
process.env.PROJECT_ID = resources.projectId(process.env.TEST_ID)

const sharedMongoAppName = () =>
    `nest-seed-test-w${process.env.VITEST_POOL_ID ?? '0'}-p${process.pid}-shared`

setupVitestLifecycle({
    connectMongo: async (workerId) => {
        const dbName = resources.databaseName(workerId)
        process.env.MONGO_DATABASE = dbName

        const client = new MongoClient(
            requiredEnvironment('MONGO_URI'),
            createMongoDriverOptions({ appName: sharedMongoAppName() })
        )
        await client.connect()
        return { client, dbName }
    },
    afterMongoConnect: attachSharedTestMongoConnection,
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
        const bucket = resources.bucketName(workerId)
        process.env.S3_BUCKET = bucket
        return bucket
    },
    onBeforeEach: (testId) => {
        process.env.PROJECT_ID = resources.projectId(testId)
    }
})

afterAll(clearSharedTestMongoConnection)

function requiredEnvironment(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`Missing required environment variable: ${name}`)
    return value
}
