import { MongooseErrors } from './mongoose'
import { JwtAuthErrors } from './services'
import { LatLongErrors, PaginationErrors } from './types'

export const CommonErrors = {
    JwtAuth: JwtAuthErrors,
    LatLong: LatLongErrors,
    Mongoose: MongooseErrors,
    Pagination: PaginationErrors
}
