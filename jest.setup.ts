import 'reflect-metadata'
import { MongoClient } from 'mongodb'
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3'
import { generateTestId, getEnv, setEnv } from './jest.utils'

let mongoClient: MongoClient
let s3Client: S3Client

beforeAll(async () => {
    mongoClient = await MongoClient.connect(getEnv('TESTLIB_MONGO_URI'))
    // Set TTL monitor interval to 1s to speed up TTL index `expires` tests
    await mongoClient.db('admin').command({ setParameter: 1, ttlMonitorSleepSecs: 1 })
    s3Client = new S3Client({
        endpoint: getEnv('TESTLIB_S3_ENDPOINT'),
        region: getEnv('TESTLIB_S3_REGION'),
        forcePathStyle: getEnv('TESTLIB_S3_FORCE_PATH_STYLE') === 'true',
        credentials: {
            accessKeyId: getEnv('TESTLIB_S3_ACCESS_KEY'),
            secretAccessKey: getEnv('TESTLIB_S3_SECRET_KEY')
        }
    })
})

beforeEach(async () => {
    const testId = generateTestId()
    setEnv('TEST_ID', testId)
    setEnv('TESTLIB_MONGO_DATABASE', `mongo-${testId}`)
    setEnv('TESTLIB_S3_BUCKET', `s3bucket${testId}`)

    await s3Client.send(new CreateBucketCommand({ Bucket: `s3bucket${testId}` }))
})

afterEach(async () => {
    const dbName = getEnv('TESTLIB_MONGO_DATABASE')
    await mongoClient.db(dbName).dropDatabase()
})

afterAll(async () => {
    await mongoClient?.close()
    s3Client?.destroy()
})
