export const AdminErrors = {
    EmailAlreadyExists: (email: string) => ({
        code: 'ERR_ADMIN_EMAIL_ALREADY_EXISTS',
        message: 'Admin with email already exists',
        email
    })
}
