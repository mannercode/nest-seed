require('reflect-metadata')
const { S3Client } = require('@aws-sdk/client-s3')
const { setupJestLifecycle } = require('@mannercode/jest-helpers')
const { MongoClient } = require('mongodb')

// `jest.global.js` 가 컨테이너를 띄우면서 채워 두는 환경 변수다. 여기에
// 워커마다 다른 이름과 상수도 더 채운다. 테스트가 돌기 전에 이 목록을
// 미리 확인해, 빠진 값이 있으면 워커 전체를 실패시킨다.
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
        // TTL 인덱스를 다루는 테스트가 빨리 끝나도록 TTL 감시 주기를 1 초로
        // 줄인다. 기본값은 60 초라 테스트 안에서 만료를 기다리기 어렵다.
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
