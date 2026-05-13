import type { SchemaOptions } from 'mongoose'

/**
 * 모든 Mongoose 스키마가 따르는 공통 정책. 도메인 모델이 @Schema 데코레이터에서
 * 이 옵션을 직접 가져와 사용한다.
 */
export const MONGOOSE_SCHEMA_OPTIONS: SchemaOptions = {
    minimize: false,
    optimisticConcurrency: true,
    strict: 'throw',
    strictQuery: 'throw',
    timestamps: true,
    toJSON: { flattenObjectIds: true, versionKey: false, virtuals: true },
    validateBeforeSave: true
}
