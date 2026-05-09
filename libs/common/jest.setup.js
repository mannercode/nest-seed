require('reflect-metadata')
const { S3Client } = require('@aws-sdk/client-s3')
const { setupJestLifecycle } = require('@mannercode/jest-helpers')
const { MongoClient } = require('mongodb')

// jest.global.js (Testcontainers boot) 가 세팅하는 env. jest.setup.js 가 여기에
// worker scope 이름과 상수를 추가한다. spec 이 돌기 전에 미리 검증해 누락이
// 있으면 worker 전체를 실패시킨다.
const REQUIRED_TESTLIB_ENV = [
    'TESTLIB_MONGO_URI',
    'TESTLIB_REDIS_URL',
    'TESTLIB_S3_ENDPOINT',
    'TESTLIB_S3_ACCESS_KEY',
    'TESTLIB_S3_SECRET_KEY',
    'TESTLIB_NATS_OPTIONS',
    'TESTLIB_TEMPORAL_ADDRESS',
    'TESTLIB_TEMPORAL_NAMESPACE'
]

beforeAll(() => {
    const missing = REQUIRED_TESTLIB_ENV.filter((key) => !process.env[key])
    if (missing.length > 0) {
        throw new Error(`Missing required test env: ${missing.join(', ')}`)
    }
})

setupJestLifecycle({
    connectMongo: async (workerId) => {
        const dbName = `mongo-w${workerId}`
        process.env.TESTLIB_MONGO_DATABASE = dbName

        const client = new MongoClient(process.env.TESTLIB_MONGO_URI)
        await client.connect()
        return { client, dbName }
    },
    afterMongoConnect: (client) =>
        // TTL index `expires` 테스트 속도를 위해 TTL monitor interval 을 1s 로 설정.
        client.db('admin').command({ setParameter: 1, ttlMonitorSleepSecs: 1 }),
    createS3Client: () => {
        process.env.TESTLIB_S3_REGION = 'us-east-1'
        process.env.TESTLIB_S3_FORCE_PATH_STYLE = 'true'
        return new S3Client({
            endpoint: process.env.TESTLIB_S3_ENDPOINT,
            region: process.env.TESTLIB_S3_REGION,
            credentials: {
                accessKeyId: process.env.TESTLIB_S3_ACCESS_KEY,
                secretAccessKey: process.env.TESTLIB_S3_SECRET_KEY
            },
            forcePathStyle: process.env.TESTLIB_S3_FORCE_PATH_STYLE.toLowerCase() === 'true'
        })
    },
    bucketName: (workerId) => {
        const bucket = `s3bucket-w${workerId}`
        process.env.TESTLIB_S3_BUCKET = bucket
        return bucket
    }
})
