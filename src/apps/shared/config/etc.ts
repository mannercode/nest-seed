import { SchemaOptions } from 'mongoose'

export class MongooseConfig {
    static connName = 'mongo'
    static schemaOptions: SchemaOptions = {
        // https://mongoosejs.com/docs/guide.html#optimisticConcurrency
        optimisticConcurrency: true,
        minimize: false,
        strict: 'throw',
        strictQuery: 'throw',
        timestamps: true,
        validateBeforeSave: true,
        // https://mongoosejs.com/docs/guide.html#collation
        collation: { locale: 'en_US', strength: 1 },
        toJSON: { virtuals: true, flattenObjectIds: true, versionKey: false }
    }
}

export class RedisConfig {
    static connName = 'redis'
}

export class Routes {
    static StorageFiles = '/storage-files' // MovieDto에서 경로를 참조한다.
}

export const isTest = () => process.env.NODE_ENV === 'test' && process.env.TEST_ID
