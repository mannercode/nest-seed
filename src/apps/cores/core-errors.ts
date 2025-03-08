import { CommonErrors } from "common";

export const CoreErrors = {
    ...CommonErrors,
    Customer: {
        NotFound: {
            code: 'ERR_CUSTOMER_NOT_FOUND',
            message: 'Customer not found'
        },
        emailAlreadyExists: {
            code: 'ERR_CUSTOMER_EMAIL_ALREADY_EXISTS',
            message: 'Customer with email already exists'
        }
    }
}
