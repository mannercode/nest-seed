import type { SchemaOptions } from 'mongoose'

export const MONGOOSE_SCHEMA_OPTIONS: SchemaOptions = {
    minimize: false,
    optimisticConcurrency: true,
    strict: 'throw',
    strictQuery: 'throw',
    timestamps: true,
    toJSON: { flattenObjectIds: true, versionKey: false, virtuals: true },
    validateBeforeSave: true
}
