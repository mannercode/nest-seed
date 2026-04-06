import { CustomerErrors, MovieErrors } from './services'
import { AuthErrors } from './services/customers/guards/errors'

export const CoreErrors = { Auth: AuthErrors, Customers: CustomerErrors, Movies: MovieErrors }
