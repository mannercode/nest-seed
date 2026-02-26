export const CustomerErrors = {
    EmailAlreadyExists: (email: string) => ({
        code: 'ERR_CUSTOMER_EMAIL_ALREADY_EXISTS',
        message: 'Customer with email already exists',
        email
    })
}
