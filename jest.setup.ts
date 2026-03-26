import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'
import 'reflect-metadata'
import { generateTestId, getEnv, setEnv } from './jest.utils'

let testlibMongoClient: MongoClient
let testlibS3Client: S3Client

beforeAll(async () => {
    await Promise.all([createTestlibMongo(), createTestlibS3Client()])
})

afterAll(async () => {
    await Promise.all([testlibMongoClient.close(), testlibS3Client.destroy()])
})

beforeEach(async () => {
    const testId = generateTestId()

    setEnv('TEST_ID', testId)
    setEnv('TESTLIB_MONGO_DATABASE', `mongo-${testId}`)

    const bucket = `s3bucket${testId}`.toLowerCase()
    setEnv('TESTLIB_S3_BUCKET', bucket)

    const temporalAddress = getEnv('TESTLIB_TEMPORAL_ADDRESS')
    const [temporalHost, temporalPort] = temporalAddress.split(':')
    setEnv('TEMPORAL_HOST', temporalHost)
    setEnv('TEMPORAL_PORT', temporalPort)
    setEnv('TEMPORAL_NAMESPACE', 'default')

    const command = new CreateBucketCommand({ Bucket: bucket })
    await testlibS3Client.send(command)
})

afterEach(async () => {
    await testlibMongoClient.db(getEnv('TESTLIB_MONGO_DATABASE')).dropDatabase()
})

async function createTestlibMongo() {
    testlibMongoClient = new MongoClient(getEnv('TESTLIB_MONGO_URI'))

    await testlibMongoClient.connect()
    // Set TTL monitor interval to 1s to speed up TTL index `expires` tests
    await testlibMongoClient.db('admin').command({ setParameter: 1, ttlMonitorSleepSecs: 1 })
}

function createTestlibS3Client() {
    setEnv('TESTLIB_S3_REGION', 'us-east-1')
    setEnv('TESTLIB_S3_FORCE_PATH_STYLE', 'true')

    testlibS3Client = new S3Client({
        endpoint: getEnv('TESTLIB_S3_ENDPOINT'),
        region: getEnv('TESTLIB_S3_REGION'),
        credentials: {
            accessKeyId: getEnv('TESTLIB_S3_ACCESS_KEY'),
            secretAccessKey: getEnv('TESTLIB_S3_SECRET_KEY')
        },
        forcePathStyle: getEnv('TESTLIB_S3_FORCE_PATH_STYLE').toLowerCase() === 'true'
    })
}
