import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'
import 'reflect-metadata'
import { generateTestId, getEnv, setEnv } from './jest.utils'

let mongoClient: MongoClient
let s3Client: S3Client

beforeAll(async () => {
    mongoClient = await connectMongo()
    s3Client = createS3Client()
})

afterAll(async () => {
    await Promise.all([mongoClient.close(), s3Client.destroy()])
})

beforeEach(async () => {
    const testId = generateTestId()

    setEnv('TEST_ID', testId)
    setEnv('PROJECT_ID', `project-${testId}`)
    setEnv('MONGO_DATABASE', `mongo-${testId}`)

    const bucket = `s3bucket${testId}`.toLowerCase()
    setEnv('S3_BUCKET', bucket)

    await s3Client.send(new CreateBucketCommand({ Bucket: bucket }))
})

afterEach(async () => {
    await mongoClient.db(getEnv('MONGO_DATABASE')).dropDatabase()
})

async function connectMongo() {
    const nodes = [
        `${getEnv('MONGO_HOST1')}:${getEnv('MONGO_PORT1')}`,
        `${getEnv('MONGO_HOST2')}:${getEnv('MONGO_PORT2')}`,
        `${getEnv('MONGO_HOST3')}:${getEnv('MONGO_PORT3')}`
    ].join(',')

    const client = new MongoClient(
        `mongodb://${getEnv('MONGO_USERNAME')}:${getEnv('MONGO_PASSWORD')}@${nodes}/?replicaSet=${getEnv('MONGO_REPLICA_SET')}`
    )

    await client.connect()
    return client
}

function createS3Client() {
    return new S3Client({
        endpoint: getEnv('S3_ENDPOINT'),
        region: getEnv('S3_REGION'),
        credentials: {
            accessKeyId: getEnv('S3_ACCESS_KEY'),
            secretAccessKey: getEnv('S3_SECRET_KEY')
        },
        forcePathStyle: getEnv('S3_FORCE_PATH_STYLE').toLowerCase() === 'true'
    })
}
