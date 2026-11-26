// HTTP 클라이언트가 받는 오류의 코드·본문이 바뀌면 통합 테스트에서 드러나야 한다.
export const expectedErrors = {
    unauthorized: { code: 'ERR_AUTH_UNAUTHORIZED', message: 'Unauthorized' },
    refreshTokenInvalid: {
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_INVALID',
        message: 'The provided refresh token is invalid'
    },
    validationFailed: (details: unknown) => ({
        code: 'ERR_REQUEST_VALIDATION_FAILED',
        message: 'Validation failed',
        details
    }),
    emailAlreadyExists: (email: string) => ({
        code: 'ERR_USER_EMAIL_ALREADY_EXISTS',
        message: 'User with email already exists',
        email
    }),
    documentNotFound: (notFoundId: string) => ({
        code: 'ERR_MONGO_DOCUMENT_NOT_FOUND',
        message: 'Document not found',
        notFoundId
    }),
    multipleDocumentsNotFound: (notFoundIds: string[]) => ({
        code: 'ERR_MONGO_MULTIPLE_DOCUMENTS_NOT_FOUND',
        message: 'One or more documents not found',
        notFoundIds
    })
}
