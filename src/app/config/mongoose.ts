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
