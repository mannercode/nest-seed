import { JwtAuthErrors } from './auth'
import { IdempotencyErrors } from './idempotency'
import { LatLongErrors } from './lat-long'
import { MongooseErrors } from './mongoose'
import { PaginationErrors } from './pagination'

export const CommonErrors = {
    JwtAuth: JwtAuthErrors,
    Idempotency: IdempotencyErrors,
    LatLong: LatLongErrors,
    Mongoose: MongooseErrors,
    Pagination: PaginationErrors
}
