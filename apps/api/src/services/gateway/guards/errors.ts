export const AuthErrors = {
    Forbidden: () => ({ code: 'ERR_AUTH_FORBIDDEN', message: 'Forbidden' }),
    Unauthorized: () => ({ code: 'ERR_AUTH_UNAUTHORIZED', message: 'Unauthorized' })
}
