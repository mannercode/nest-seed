import { JwtAuthErrors } from './jwt-auth'
import { LatLongErrors } from './lat-long'
import { MongooseErrors } from './mongoose'
import { PaginationErrors } from './pagination'

export const CommonErrors = {
    JwtAuth: JwtAuthErrors,
    LatLong: LatLongErrors,
    Mongoose: MongooseErrors,
    Pagination: PaginationErrors
}
