import {
    getMongoTestConnection,
    getNatsTestConnection,
    getRedisTestConnection,
    getS3TestConnection,
    getTemporalTestConnection
} from '../infra-connections'

describe('infra-connections', () => {
    // 환경 변수가 누락되었을 때
    describe('when a required env var is missing', () => {
        let originalValue: string | undefined

        beforeEach(() => {
            originalValue = process.env.TESTLIB_REDIS_URL
            delete process.env.TESTLIB_REDIS_URL
        })
        afterEach(() => {
            if (originalValue !== undefined) process.env.TESTLIB_REDIS_URL = originalValue
        })

        // missing 변수명을 포함한 명시적 에러를 던진다
        it('throws an explicit error naming the missing variable', () => {
            expect(() => getRedisTestConnection()).toThrow(/TESTLIB_REDIS_URL/)
        })
    })

    // 환경 변수가 모두 설정되어 있을 때
    describe('when all required env vars are present', () => {
        // 각 helper 가 정상 값을 반환한다
        it('returns connection info for every helper', () => {
            expect(getRedisTestConnection()).toBe(process.env.TESTLIB_REDIS_URL)
            expect(getMongoTestConnection()).toEqual({
                dbName: process.env.TESTLIB_MONGO_DATABASE,
                uri: process.env.TESTLIB_MONGO_URI
            })
            const natsOptions = process.env.TESTLIB_NATS_OPTIONS ?? ''
            expect(getNatsTestConnection()).toEqual(JSON.parse(natsOptions))
            expect(getTemporalTestConnection()).toEqual({
                address: process.env.TESTLIB_TEMPORAL_ADDRESS,
                namespace: process.env.TESTLIB_TEMPORAL_NAMESPACE
            })
            const s3 = getS3TestConnection()
            expect(s3.endpoint).toBe(process.env.TESTLIB_S3_ENDPOINT)
            expect(s3.bucket).toBe(process.env.TESTLIB_S3_BUCKET)
        })
    })
})
