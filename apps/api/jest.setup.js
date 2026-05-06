require('reflect-metadata')
const { CreateBucketCommand, S3Client } = require('@aws-sdk/client-s3')
const { cleanCollections, emptyBucket, generateTestId } = require('@mannercode/jest-helpers')
const { MongoClient } = require('mongodb')

process.loadEnvFile('.env')

let mongoClient
let s3Client

beforeAll(async () => {
    const workerId = process.env.JEST_WORKER_ID ?? '1'
    process.env.MONGO_DATABASE = `mongo-w${workerId}`
    process.env.S3_BUCKET = `s3bucket-w${workerId}`

    mongoClient = await connectMongo()
    s3Client = createS3Client()

    await ensureBucket(process.env.S3_BUCKET)
    await cleanCollections(mongoClient, process.env.MONGO_DATABASE)
    await emptyBucket(s3Client, process.env.S3_BUCKET)
})

afterAll(async () => {
    await Promise.all([mongoClient.close(), s3Client.destroy()])
})

beforeEach(async () => {
    const testId = generateTestId()
    process.env.TEST_ID = testId
    process.env.PROJECT_ID = `project-${testId}`
})

afterEach(async () => {
    await Promise.all([
        cleanCollections(mongoClient, process.env.MONGO_DATABASE),
        emptyBucket(s3Client, process.env.S3_BUCKET)
    ])
})

async function ensureBucket(bucket) {
    try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucket }))
    } catch (err) {
        if (err.name !== 'BucketAlreadyOwnedByYou' && err.name !== 'BucketAlreadyExists') {
            throw err
        }
    }
}

async function connectMongo() {
    const nodes = [
        `${process.env.MONGO_HOST1}:${process.env.MONGO_PORT1}`,
        `${process.env.MONGO_HOST2}:${process.env.MONGO_PORT2}`,
        `${process.env.MONGO_HOST3}:${process.env.MONGO_PORT3}`
    ].join(',')

    const client = new MongoClient(
        `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${nodes}/?replicaSet=${process.env.MONGO_REPLICA_SET}`
    )

    await client.connect()
    return client
}

function createS3Client() {
    return new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY,
            secretAccessKey: process.env.S3_SECRET_KEY
        },
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE.toLowerCase() === 'true'
    })
}
