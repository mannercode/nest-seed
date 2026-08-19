export const AuthErrors = {
    LoginRateLimited: () => ({
        code: 'ERR_AUTH_LOGIN_RATE_LIMITED',
        message: 'Too many login attempts'
    }),
    Unauthorized: () => ({ code: 'ERR_AUTH_UNAUTHORIZED', message: 'Unauthorized' })
}
