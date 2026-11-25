import 'reflect-metadata'
import { S3Client } from '@aws-sdk/client-s3'
import { getVitestWorkerId, setupVitestLifecycle } from '@mannercode/tools/vitest-helpers'
import { MongoClient } from 'mongodb'
import { createMongoDriverOptions } from '@mannercode/common'
import {
    attachSharedTestMongoConnection,
    clearSharedTestMongoConnection
} from './src/__tests__/helpers/shared-mongo-connection.js'

import {
    projectId,
    testConfig,
    workerBucket,
    workerDatabase
} from './src/__tests__/helpers/resources.js'

process.env.LOG_CONSOLE_LEVEL = 'silent'
process.env.RESTATE_SERVICE_PORT = '0'

// 테스트 파일을 읽기 전에 worker의 초기값을 설정하고, 테스트마다 PROJECT_ID를 바꾼다.
process.env.TEST_ID = `startup-w${getVitestWorkerId()}`
process.env.PROJECT_ID = projectId(process.env.TEST_ID)
const config = testConfig()

setupVitestLifecycle({
    connectMongo: async (workerId) => {
        const dbName = workerDatabase.name(workerId)
        process.env.MONGO_DATABASE = dbName

        const client = new MongoClient(
            config.mongo.uri,
            createMongoDriverOptions({
                appName: `nest-seed-test-w${workerId}-p${process.pid}-shared`
            })
        )
        await client.connect()
        return { client, dbName }
    },
    afterMongoConnect: attachSharedTestMongoConnection,
    createS3Client: () => new S3Client(config.s3),
    bucketName: (workerId) => {
        const bucket = workerBucket.name(workerId)
        process.env.S3_BUCKET = bucket
        return bucket
    },
    onBeforeEach: (testId) => {
        process.env.PROJECT_ID = projectId(testId)
    }
})

afterAll(clearSharedTestMongoConnection)
afterEach(() => vi.unstubAllEnvs())
