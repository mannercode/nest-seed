import { Env } from 'common'

export function getRedisTestConnection() {
    return Env.getString('TESTLIB_REDIS_URL')
}

export const getNatsTestConnection = () => {
    return JSON.parse(Env.getString('TESTLIB_NATS_OPTIONS'))
}

export const getMongoTestConnection = () => {
    return {
        uri: Env.getString('TESTLIB_MONGO_URI'),
        dbName: Env.getString('TESTLIB_MONGO_DATABASE')
    }
}

export const getS3TestConnection = () => {
    const endpoint = Env.getString('TESTLIB_S3_ENDPOINT')
    const accessKeyId = Env.getString('TESTLIB_S3_ACCESS_KEY')
    const secretAccessKey = Env.getString('TESTLIB_S3_SECRET_KEY')
    const region = Env.getString('TESTLIB_S3_REGION')
    const forcePathStyle = Env.getBoolean('TESTLIB_S3_FORCE_PATH_STYLE')
    const bucket = Env.getString('TESTLIB_S3_BUCKET')

    return { endpoint, accessKeyId, secretAccessKey, region, forcePathStyle, bucket }
}
