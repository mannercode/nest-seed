require('reflect-metadata')
const { CreateBucketCommand, S3Client } = require('@aws-sdk/client-s3')
const { MongoClient } = require('mongodb')
const { cleanCollections, emptyBucket, generateTestId } = require('@mannercode/jest-helpers')

let mongoClient
let s3Client

beforeAll(async () => {
    const workerId = process.env.JEST_WORKER_ID ?? '1'
    process.env.TESTLIB_MONGO_DATABASE = `mongo-w${workerId}`
    process.env.TESTLIB_S3_BUCKET = `s3bucket-w${workerId}`
    process.env.TESTLIB_S3_REGION = 'us-east-1'
    process.env.TESTLIB_S3_FORCE_PATH_STYLE = 'true'

    mongoClient = new MongoClient(process.env.TESTLIB_MONGO_URI)
    await mongoClient.connect()
    // Set TTL monitor interval to 1s to speed up TTL index `expires` tests
    await mongoClient.db('admin').command({ setParameter: 1, ttlMonitorSleepSecs: 1 })

    s3Client = new S3Client({
        endpoint: process.env.TESTLIB_S3_ENDPOINT,
        region: process.env.TESTLIB_S3_REGION,
        credentials: {
            accessKeyId: process.env.TESTLIB_S3_ACCESS_KEY,
            secretAccessKey: process.env.TESTLIB_S3_SECRET_KEY
        },
        forcePathStyle: process.env.TESTLIB_S3_FORCE_PATH_STYLE.toLowerCase() === 'true'
    })

    await ensureBucket(process.env.TESTLIB_S3_BUCKET)
    await Promise.all([
        cleanCollections(mongoClient, process.env.TESTLIB_MONGO_DATABASE),
        emptyBucket(s3Client, process.env.TESTLIB_S3_BUCKET)
    ])
})

afterAll(async () => {
    await Promise.all([mongoClient.close(), s3Client.destroy()])
})

beforeEach(async () => {
    const testId = generateTestId()
    process.env.TEST_ID = testId
})

afterEach(async () => {
    await Promise.all([
        cleanCollections(mongoClient, process.env.TESTLIB_MONGO_DATABASE),
        emptyBucket(s3Client, process.env.TESTLIB_S3_BUCKET)
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
