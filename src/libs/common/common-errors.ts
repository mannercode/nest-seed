export const CommonErrors = {
    DocumentNotFound1: {
        code: 'ERR_DOCUMENT_NOT_FOUND',
        message: `Document not found`
    },
    DocumentNotFound2: {
        code: 'ERR_DOCUMENT_NOT_FOUND',
        message: `One or more Documents with IDs not found`
    },
    InvalidPagination1: {
        code: 'ERR_INVALID_PAGINATION',
        message: `'take' must be specified.`
    },
    InvalidPagination2: {
        code: 'ERR_INVALID_PAGINATION',
        message: `'take' must be a positive number`
    },
    MongooseFiltersRequired: {
        code: 'ERR_MONGOOSE_FILTERS_REQUIRED',
        message: 'At least one filter condition must be provided.'
    },
    ValidationFailed: {
        code: 'ERR_VALIDATION_FAILED',
        message: 'Validation failed'
    },
    LatlongRequired: {
        code: 'ERR_LATLONG_REQUIRED',
        message: 'The latlong query parameter is required.'
    },
    LatlongFormatInvalid: {
        code: 'ERR_LATLONG_FORMAT_INVALID',
        message: 'Latlong should be in the format "latitude,longitude".'
    },
    LatlongValidationFailed: {
        code: 'ERR_LATLONG_VALIDATION_FAILED',
        message: 'Latlong validation failed.'
    },
    FileUploadMaxCountExceed: {
        code: 'ERR_FILE_UPLOAD_MAX_COUNT_EXCEED',
        message: 'Too many files'
    },
    FileUploadMaxSizeExceed: {
        code: 'ERR_FILE_UPLOAD_MAX_SIZE_EXCEED',
        message: 'File too large'
    },
    PaginationTakeLimitExceeded: {
        code: 'ERR_PAGINATION_TAKE_LIMIT_EXCEEDED',
        message: "The 'take' parameter exceeds the maximum allowed limit."
    },
    JwtAuthRefreshTokenInvalid: {
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_INVALID',
        message: 'The provided refresh token is invalid.'
    },
    JwtAuthRefreshTokenVerificationFailed: {
        code: 'ERR_JWT_AUTH_REFRESH_TOKEN_VERIFICATION_FAILED',
        message: '??'
    }
}
