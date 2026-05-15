require('reflect-metadata')
const { S3Client } = require('@aws-sdk/client-s3')
const { setupJestLifecycle } = require('@mannercode/jest-helpers')
const { MongoClient } = require('mongodb')
const path = require('path')

process.loadEnvFile(path.resolve(__dirname, '.env'))

setupJestLifecycle({
    connectMongo: async (workerId) => {
        const dbName = `mongo-w${workerId}`
        process.env.MONGO_DATABASE = dbName

        const client = new MongoClient(process.env.MONGO_URI)
        await client.connect()
        return { client, dbName }
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
