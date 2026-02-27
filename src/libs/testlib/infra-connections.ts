import { Env } from 'common'

export function getRedisTestConnection() {
    return Env.getString('TESTLIB_REDIS_URL')
}

export function getNatsTestConnection() {
    return JSON.parse(Env.getString('TESTLIB_NATS_OPTIONS'))
}

export function getMongoTestConnection() {
    return {
        dbName: Env.getString('TESTLIB_MONGO_DATABASE'),
        uri: Env.getString('TESTLIB_MONGO_URI')
    }
}

export function getS3TestConnection() {
    const endpoint = Env.getString('TESTLIB_S3_ENDPOINT')
    const region = Env.getString('TESTLIB_S3_REGION')
    const forcePathStyle = Env.getBoolean('TESTLIB_S3_FORCE_PATH_STYLE')
    const bucket = Env.getString('TESTLIB_S3_BUCKET')
    const credentials = {
        accessKeyId: Env.getString('TESTLIB_S3_ACCESS_KEY'),
        secretAccessKey: Env.getString('TESTLIB_S3_SECRET_KEY')
    }

    return { bucket, credentials, endpoint, forcePathStyle, region }
}
