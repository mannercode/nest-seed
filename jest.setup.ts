import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'
import 'reflect-metadata'
import { generateTestId, getEnv, setEnv } from './jest.utils'

let appsMongoClient: MongoClient
let appsS3Client: S3Client

beforeAll(async () => {
    await Promise.all([createAppsMongo(), createAppsS3Client()])
})

afterAll(async () => {
    await Promise.all([appsMongoClient.close(), appsS3Client.destroy()])
})

beforeEach(async () => {
    const testId = generateTestId()

    setEnv('TEST_ID', testId)
    setEnv('PROJECT_ID', `project-${testId}`)
    setEnv('MONGO_DATABASE', `mongo-${testId}`)

    const bucket = `s3bucket${testId}`.toLowerCase()
    setEnv('S3_BUCKET', bucket)

    const command = new CreateBucketCommand({ Bucket: bucket })
    await appsS3Client.send(command)
})

afterEach(async () => {
    await appsMongoClient.db(getEnv('MONGO_DATABASE')).dropDatabase()
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

function createAppsS3Client() {
    appsS3Client = createS3Client(
        getEnv('S3_ENDPOINT'),
        getEnv('S3_REGION'),
        getEnv('S3_ACCESS_KEY'),
        getEnv('S3_SECRET_KEY'),
        getEnv('S3_FORCE_PATH_STYLE')
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
