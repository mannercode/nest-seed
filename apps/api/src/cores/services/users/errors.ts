export const UserErrors = {
    EmailAlreadyExists: (email: string) => ({
        code: 'ERR_USER_EMAIL_ALREADY_EXISTS',
        message: 'User with email already exists',
        email
    })
}
