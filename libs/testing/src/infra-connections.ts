function envString(key: string): string {
    const value = process.env[key]
    if (!value) throw new Error(`Environment variable ${key} is not defined`)
    return value
}

export function getRedisTestConnection() {
    return envString('TESTLIB_REDIS_URL')
}

export function getMongoTestConnection() {
    return { dbName: envString('TESTLIB_MONGO_DATABASE'), uri: envString('TESTLIB_MONGO_URI') }
}

export function getS3TestConnection() {
    const endpoint = envString('TESTLIB_S3_ENDPOINT')
    const region = envString('TESTLIB_S3_REGION')
    const forcePathStyle = envString('TESTLIB_S3_FORCE_PATH_STYLE').toLowerCase() === 'true'
    const bucket = envString('TESTLIB_S3_BUCKET')
    const credentials = {
        accessKeyId: envString('TESTLIB_S3_ACCESS_KEY'),
        secretAccessKey: envString('TESTLIB_S3_SECRET_KEY')
    }

    return { bucket, credentials, endpoint, forcePathStyle, region }
}
