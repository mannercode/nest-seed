import { JwtAuthErrors } from './auth/index.js'
import { IdempotencyErrors } from './idempotency/index.js'
import { LatLongErrors } from './lat-long/index.js'
import { MongoErrors } from './mongodb/index.js'
import { PaginationErrors } from './pagination/index.js'

export const CommonErrors = {
    JwtAuth: JwtAuthErrors,
    Idempotency: IdempotencyErrors,
    LatLong: LatLongErrors,
    Mongo: MongoErrors,
    Pagination: PaginationErrors
}
