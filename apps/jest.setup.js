require('reflect-metadata')
const { CreateBucketCommand, S3Client } = require('@aws-sdk/client-s3')
const { MongoClient } = require('mongodb')

process.loadEnvFile('.env')

let mongoClient
let s3Client

beforeAll(async () => {
    mongoClient = await connectMongo()
    s3Client = createS3Client()
})

afterAll(async () => {
    await Promise.all([mongoClient.close(), s3Client.destroy()])
})

beforeEach(async () => {
    const testId = generateTestId()

    process.env.TEST_ID = testId
    process.env.PROJECT_ID = `project-${testId}`
    process.env.MONGO_DATABASE = `mongo-${testId}`

    const bucket = `s3bucket${testId}`.toLowerCase()
    process.env.S3_BUCKET = bucket

    await s3Client.send(new CreateBucketCommand({ Bucket: bucket }))
})

afterEach(async () => {
    await mongoClient.db(process.env.MONGO_DATABASE).dropDatabase()
})

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

function generateTestId() {
    const chars = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
        ''
    )
}
