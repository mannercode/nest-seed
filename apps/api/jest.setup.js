const { initializeApiJestWorkerEnvironment } = require('./scripts/jest-resource-wiring')

// app 모듈이 PROJECT_ID를 최초 평가하기 전에 공유 .env 값을 실행별 namespace로 덮어쓴다.
const resourceScope = initializeApiJestWorkerEnvironment()

require('reflect-metadata')
const { S3Client } = require('@aws-sdk/client-s3')
const { setupJestLifecycle } = require('@mannercode/jest-helpers')
const { MongoClient } = require('mongodb')
const { createMongoDriverOptions } = require('./src/config/mongo-driver-options')
const { registerMongoClientDiagnostics } = require('./src/modules/mongoose-setup.module')
const {
    attachSharedTestMongooseConnection,
    clearSharedTestMongooseConnection
} = require('./scripts')

const sharedMongoAppName = () =>
    `nest-seed-test-w${process.env.JEST_WORKER_ID ?? '0'}-p${process.pid}-shared`

setupJestLifecycle({
    connectMongo: async (workerId) => {
        const dbName = resourceScope.databaseName(workerId)
        process.env.MONGO_DATABASE = dbName

        const client = new MongoClient(
            process.env.MONGO_URI,
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
            endpoint: process.env.S3_ENDPOINT,
            region: process.env.S3_REGION,
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY,
                secretAccessKey: process.env.S3_SECRET_KEY
            },
            forcePathStyle: process.env.S3_FORCE_PATH_STYLE.toLowerCase() === 'true'
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
