require('reflect-metadata')
const { S3Client } = require('@aws-sdk/client-s3')
const { setupJestLifecycle } = require('@mannercode/jest-helpers')
const { MongoClient } = require('mongodb')

process.loadEnvFile('.env')

setupJestLifecycle({
    connectMongo: async (workerId) => {
        const dbName = `mongo-w${workerId}`
        process.env.MONGO_DATABASE = dbName

        const nodes = [
            `${process.env.MONGO_HOST1}:${process.env.MONGO_PORT1}`,
            `${process.env.MONGO_HOST2}:${process.env.MONGO_PORT2}`,
            `${process.env.MONGO_HOST3}:${process.env.MONGO_PORT3}`
        ].join(',')
        const client = new MongoClient(
            `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${nodes}/?replicaSet=${process.env.MONGO_REPLICA_SET}`
        )
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
