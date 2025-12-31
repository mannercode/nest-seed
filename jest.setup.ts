import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'
import 'reflect-metadata'
import { generateTestId, getEnv, setEnv } from './jest.utils'

let appsMongoClient: MongoClient
let appsS3Client: S3Client

let testlibMongoClient: MongoClient
let testlibS3Client: S3Client

beforeAll(async () => {
    await Promise.all([
        createAppsMongo(),
        createAppsS3Client(),
        createTestlibMongo(),
        createTestlibS3Client()
    ])
})

afterAll(async () => {
    await Promise.all([
        appsMongoClient.close(),
        testlibMongoClient.close(),
        appsS3Client.destroy(),
        testlibS3Client.destroy()
    ])
})

beforeEach(async () => {
    const testId = generateTestId()

    setEnv('TEST_ID', testId)
    setEnv('PROJECT_ID', `project-${testId}`)
    setEnv('MONGO_DATABASE', `mongo-${testId}`)
    setEnv('TESTLIB_MONGO_DATABASE', `mongo-${testId}`)

    const bucket = `s3bucket${testId}`.toLowerCase()
    setEnv('S3_BUCKET', bucket)
    setEnv('TESTLIB_S3_BUCKET', bucket)

    const command = new CreateBucketCommand({ Bucket: bucket })
    await appsS3Client.send(command)
    await testlibS3Client.send(command)
})

afterEach(async () => {
    await Promise.all([
        appsMongoClient.db(getEnv('MONGO_DATABASE')).dropDatabase(),
        testlibMongoClient.db(getEnv('TESTLIB_MONGO_DATABASE')).dropDatabase()
    ])
})

async function createAppsMongo() {
    const nodes = [
        `${getEnv('MONGO_HOST1')}:${getEnv('MONGO_PORT1')}`,
        `${getEnv('MONGO_HOST2')}:${getEnv('MONGO_PORT2')}`,
        `${getEnv('MONGO_HOST3')}:${getEnv('MONGO_PORT3')}`
    ].join(',')

    appsMongoClient = new MongoClient(
        `mongodb://${getEnv('MONGO_USERNAME')}:${getEnv('MONGO_PASSWORD')}@${nodes}/?replicaSet=${getEnv('MONGO_REPLICA_SET')}`
    )

    await appsMongoClient.connect()
}

async function createTestlibMongo() {
    testlibMongoClient = new MongoClient(getEnv('TESTLIB_MONGO_URI'))

    await testlibMongoClient.connect()
    // Set TTL monitor interval to 1s to speed up TTL index `expires` tests
    // TTL 인덱스 expires 동작을 빠르게 테스트하기 위해 TTL 모니터 주기를 1초로 설정
    await testlibMongoClient.db('admin').command({ setParameter: 1, ttlMonitorSleepSecs: 1 })
}

function createAppsS3Client() {
    appsS3Client = createS3Client(
        getEnv('S3_ENDPOINT'),
        getEnv('S3_REGION'),
        getEnv('S3_ACCESS_KEY'),
        getEnv('S3_SECRET_KEY'),
        getEnv('S3_FORCE_PATH_STYLE')
    )
}

function createTestlibS3Client() {
    setEnv('TESTLIB_S3_REGION', 'us-east-1')
    setEnv('TESTLIB_S3_FORCE_PATH_STYLE', 'true')

    testlibS3Client = createS3Client(
        getEnv('TESTLIB_S3_ENDPOINT'),
        getEnv('TESTLIB_S3_REGION'),
        getEnv('TESTLIB_S3_ACCESS_KEY'),
        getEnv('TESTLIB_S3_SECRET_KEY'),
        getEnv('TESTLIB_S3_FORCE_PATH_STYLE')
    )
}

function createS3Client(
    endpoint: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    forcePathStyle: string
) {
    return new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: forcePathStyle.toLowerCase() === 'true'
    })
}
