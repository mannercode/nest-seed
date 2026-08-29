import { MovieErrors } from './movies/index.js'
import { TheaterErrors } from './theaters/index.js'
import { UserErrors } from './users/index.js'

export const CoreErrors = { Users: UserErrors, Movies: MovieErrors, Theaters: TheaterErrors }
