import 'reflect-metadata'
import { S3Client } from '@aws-sdk/client-s3'
import { setupVitestLifecycle } from '@mannercode/tools/vitest-helpers'
import { MongoClient } from 'mongodb'
import { createMongoDriverOptions } from '@mannercode/common'
import {
    attachSharedTestMongoConnection,
    clearSharedTestMongoConnection
} from './src/__tests__/helpers/shared-mongo-connection.js'

import {
    bucketName,
    databaseName,
    projectId,
    testConfig
} from './src/__tests__/helpers/resources.js'

process.env.LOG_CONSOLE_LEVEL = 'silent'
process.env.RESTATE_SERVICE_PORT = '0'

// 테스트 파일을 읽기 전에 worker의 초기값을 설정하고, 테스트마다 PROJECT_ID를 바꾼다.
process.env.TEST_ID = `startup-w${process.env.VITEST_POOL_ID ?? '1'}`
process.env.PROJECT_ID = projectId(process.env.TEST_ID)
const config = testConfig()

const sharedMongoAppName = () =>
    `nest-seed-test-w${process.env.VITEST_POOL_ID ?? '0'}-p${process.pid}-shared`

setupVitestLifecycle({
    connectMongo: async (workerId) => {
        const dbName = databaseName(workerId)
        process.env.MONGO_DATABASE = dbName

        const client = new MongoClient(
            config.mongo.uri,
            createMongoDriverOptions({ appName: sharedMongoAppName() })
        )
        await client.connect()
        return { client, dbName }
    },
    afterMongoConnect: attachSharedTestMongoConnection,
    createS3Client: () => new S3Client(config.s3),
    bucketName: (workerId) => {
        const bucket = bucketName(workerId)
        process.env.S3_BUCKET = bucket
        return bucket
    },
    onBeforeEach: (testId) => {
        process.env.PROJECT_ID = projectId(testId)
    }
})

afterAll(clearSharedTestMongoConnection)
afterEach(() => vi.unstubAllEnvs())
