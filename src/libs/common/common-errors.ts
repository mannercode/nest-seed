export const CommonErrors = {
    Mongoose: {
        FiltersRequired: {
            code: 'ERR_MONGOOSE_FILTERS_REQUIRED',
            message: 'At least one filter condition must be provided'
        },
        DocumentNotFound: {
            code: 'ERR_MONGOOSE_DOCUMENT_NOT_FOUND',
            message: 'Document not found'
        },
        MultipleDocumentsNotFound: {
            code: 'ERR_MONGOOSE_MULTIPLE_DOCUMENTS_NOT_FOUND',
            message: 'One or more documents not found'
        }
    },
    ValidationFailed: {
        code: 'ERR_VALIDATION_FAILED',
        message: 'Validation failed'
    },
    Pagination: {
        TakeMissing: {
            code: 'ERR_PAGINATION_TAKE_MISSING',
            message: 'take must be specified'
        },
        TakeInvalid: {
            code: 'ERR_PAGINATION_TAKE_INVALID',
            message: 'take must be a positive number'
        },
        TakeLimitExceeded: {
            code: 'ERR_PAGINATION_TAKE_LIMIT_EXCEEDED',
            message: "The 'take' parameter exceeds the maximum allowed limit"
        }
    },
    LatLong: {
        Required: {
            code: 'ERR_LATLONG_REQUIRED',
            message: 'The latlong query parameter is required'
        },
        FormatInvalid: {
            code: 'ERR_LATLONG_FORMAT_INVALID',
            message: 'LatLong should be in the format "latitude,longitude"'
        },
        ValidationFailed: {
            code: 'ERR_LATLONG_VALIDATION_FAILED',
            message: 'LatLong validation failed'
        }
    },
    FileUpload: {
        MaxCountExceeded: {
            code: 'ERR_FILE_UPLOAD_MAX_COUNT_EXCEEDED',
            message: 'Too many files'
        },
        MaxSizeExceeded: {
            code: 'ERR_FILE_UPLOAD_MAX_SIZE_EXCEEDED',
            message: 'File too large'
        }
    },
    JwtAuth: {
        RefreshTokenInvalid: {
            code: 'ERR_JWT_AUTH_REFRESH_TOKEN_INVALID',
            message: 'The provided refresh token is invalid'
        },
        RefreshTokenVerificationFailed: {
            code: 'ERR_JWT_AUTH_REFRESH_TOKEN_VERIFICATION_FAILED',
            message: 'Refresh token verification failed'
        }
    }
}
