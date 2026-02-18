import { MongooseErrors } from './mongoose'
import { JwtAuthServiceErrors } from './services'
import { LatLongErrors, PaginationErrors } from './types'

export const CommonErrors = {
    JwtAuth: JwtAuthServiceErrors,
    LatLong: LatLongErrors,
    Mongoose: MongooseErrors,
    Pagination: PaginationErrors
}
