import { notUsed } from 'common'
import * as dotenv from 'dotenv'
import { existsSync } from 'fs'
import { exit } from 'process'
import { getNumber, getString } from './utils'

export const matchesEnv = (env: 'production' | 'development') => getString('NODE_ENV') === env

if (matchesEnv('development')) {
    dotenv.config({ path: '.env.development' })
}

export const Config = {
    http: {
        requestPayloadLimit: getString('HTTP_REQUEST_PAYLOAD_LIMIT'),
        paginationMaxSize: getNumber('HTTP_PAGINATION_MAX_SIZE'),
        paginationDefaultSize: getNumber('HTTP_PAGINATION_DEFAULT_SIZE')
    },
    service: {
        port: getNumber('SERVICE_PORT')
    },
    auth: {
        accessSecret: getString('AUTH_ACCESS_SECRET'),
        accessTokenExpiration: getString('AUTH_ACCESS_TOKEN_EXPIRATION'),
        refreshSecret: getString('AUTH_REFRESH_SECRET'),
        refreshTokenExpiration: getString('AUTH_REFRESH_TOKEN_EXPIRATION')
    },
    log: {
        directory: getString('LOG_DIRECTORY'),
        daysToKeepLogs: getString('LOG_DAYS_TO_KEEP'),
        fileLogLevel: getString('LOG_FILE_LEVEL'),
        consoleLogLevel: getString('LOG_CONSOLE_LEVEL')
    },
    redis: {
        host: getString('REDIS_HOST'),
        port: getNumber('REDIS_PORT')
        // ttl: defaults to 5
    },
    mongo: {
        host1: getString('MONGO_DB_HOST1'),
        host2: getString('MONGO_DB_HOST2'),
        host3: getString('MONGO_DB_HOST3'),
        port: getNumber('MONGO_DB_PORT'),
        replica: getString('MONGO_DB_REPLICA_NAME'),
        user: getString('MONGO_DB_USERNAME'),
        pass: getString('MONGO_DB_PASSWORD'),
        database: getString('MONGO_DB_DATABASE')
    },
    fileUpload: {
        directory: getString('FILE_UPLOAD_DIRECTORY'),
        maxFileSizeBytes: getNumber('FILE_UPLOAD_MAX_FILE_SIZE_BYTES'),
        maxFilesPerUpload: getNumber('FILE_UPLOAD_MAX_FILES_PER_UPLOAD'),
        allowedMimeTypes: getString('FILE_UPLOAD_ALLOWED_FILE_TYPES').split(',')
    }
}

if (!existsSync(Config.fileUpload.directory)) {
    console.log(`File upload directory does not exist: ${Config.fileUpload.directory}`)
    exit(1)
}

if (!existsSync(Config.log.directory)) {
    console.log(`Log directory does not exist: ${Config.log.directory}`)
    exit(1)
}

export const mongoDataSource = () => {
    const { user, pass, host1, host2, host3, port, replica, database } = Config.mongo
    notUsed(host3, 'No need to list all three')
    const uri = `mongodb://${user}:${pass}@${host1}:${port},${host2}:${port}/?replicaSet=${replica}`
    const uniqueId = (global as any).JEST_UNIQUE_ID
    const dbName = uniqueId ? 'test_' + uniqueId : database

    return { uri, dbName }
}
