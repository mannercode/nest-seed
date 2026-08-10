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
        const dbName = `mongo-w${workerId}`
        process.env.MONGO_DATABASE = dbName

        const client = new MongoClient(
            process.env.MONGO_URI,
            createMongoDriverOptions({ appName: sharedMongoAppName() })
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
        const bucket = `s3bucket-w${workerId}`
        process.env.S3_BUCKET = bucket
        return bucket
    },
    onBeforeEach: (testId) => {
        process.env.PROJECT_ID = `project-${testId}`
    }
})

afterAll(() => {
    clearSharedTestMongooseConnection()
})
