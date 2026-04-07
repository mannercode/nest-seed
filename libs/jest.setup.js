require('reflect-metadata')
const { CreateBucketCommand, S3Client } = require('@aws-sdk/client-s3')
const { MongoClient } = require('mongodb')

let mongoClient
let s3Client

beforeAll(async () => {
    await Promise.all([createTestlibMongo(), createTestlibS3Client()])
})

afterAll(async () => {
    await Promise.all([mongoClient.close(), s3Client.destroy()])
})

beforeEach(async () => {
    const testId = generateTestId()

    process.env.TEST_ID = testId
    process.env.TESTLIB_MONGO_DATABASE = `mongo-${testId}`

    const bucket = `s3bucket${testId}`.toLowerCase()
    process.env.TESTLIB_S3_BUCKET = bucket

    await s3Client.send(new CreateBucketCommand({ Bucket: bucket }))
})

afterEach(async () => {
    await mongoClient.db(process.env.TESTLIB_MONGO_DATABASE).dropDatabase()
})

async function createTestlibMongo() {
    mongoClient = new MongoClient(process.env.TESTLIB_MONGO_URI)

    await mongoClient.connect()
    // Set TTL monitor interval to 1s to speed up TTL index `expires` tests
    await mongoClient.db('admin').command({ setParameter: 1, ttlMonitorSleepSecs: 1 })
}

function createTestlibS3Client() {
    process.env.TESTLIB_S3_REGION = 'us-east-1'
    process.env.TESTLIB_S3_FORCE_PATH_STYLE = 'true'

    s3Client = new S3Client({
        endpoint: process.env.TESTLIB_S3_ENDPOINT,
        region: process.env.TESTLIB_S3_REGION,
        credentials: {
            accessKeyId: process.env.TESTLIB_S3_ACCESS_KEY,
            secretAccessKey: process.env.TESTLIB_S3_SECRET_KEY
        },
        forcePathStyle: process.env.TESTLIB_S3_FORCE_PATH_STYLE.toLowerCase() === 'true'
    })
}

function generateTestId() {
    const chars = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
        ''
    )
}
