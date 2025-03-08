export const CommonErrors = {
    DocumentNotFound: {
        code: 'ERR_DOCUMENT_NOT_FOUND',
        message: 'Document not found'
    },
    MultipleDocumentsNotFound: {
        code: 'ERR_MULTIPLE_DOCUMENTS_NOT_FOUND',
        message: 'One or more documents not found'
    },
    PaginationTakeMissing: {
        code: 'ERR_PAGINATION_TAKE_MISSING',
        message: 'take must be specified'
    },
    PaginationTakeInvalid: {
        code: 'ERR_PAGINATION_TAKE_INVALID',
        message: 'take must be a positive number'
    },
    MongooseFiltersRequired: {
        code: 'ERR_MONGOOSE_FILTERS_REQUIRED',
        message: 'At least one filter condition must be provided'
    },
    ValidationFailed: {
        code: 'ERR_VALIDATION_FAILED',
        message: 'Validation failed'
    },
    LatlongRequired: {
        code: 'ERR_LATLONG_REQUIRED',
        message: 'The latlong query parameter is required'
    },
    LatlongFormatInvalid: {
        code: 'ERR_LATLONG_FORMAT_INVALID',
        message: 'Latlong should be in the format "latitude,longitude"'
    },
    LatlongValidationFailed: {
        code: 'ERR_LATLONG_VALIDATION_FAILED',
        message: 'Latlong validation failed'
    },
    FileUploadMaxCountExceeded: {
        code: 'ERR_FILE_UPLOAD_MAX_COUNT_EXCEEDED',
        message: 'Too many files'
    },
    FileUploadMaxSizeExceeded: {
        code: 'ERR_FILE_UPLOAD_MAX_SIZE_EXCEEDED',
        message: 'File too large'
    },
    PaginationTakeLimitExceeded: {
        code: 'ERR_PAGINATION_TAKE_LIMIT_EXCEEDED',
        message: "The 'take' parameter exceeds the maximum allowed limit"
    },
    JwtAuthRefreshTokenInvalid: {
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_INVALID',
        message: 'The provided refresh token is invalid'
    },
    JwtAuthRefreshTokenVerificationFailed: {
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_VERIFICATION_FAILED',
        message: 'Refresh token verification failed'
    }
}
