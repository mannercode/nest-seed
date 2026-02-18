export const MongooseErrors = {
    DocumentNotFound: { code: 'ERR_MONGOOSE_DOCUMENT_NOT_FOUND', message: 'Document not found' },
    FiltersRequired: {
        code: 'ERR_MONGOOSE_FILTERS_REQUIRED',
        message: 'At least one filter condition must be provided'
    },
    MaxTakeExceeded: {
        code: 'ERR_MONGOOSE_MAX_TAKE_EXCEEDED',
        message: "The 'take' parameter exceeds the maximum allowed value"
    },
    MultipleDocumentsNotFound: {
        code: 'ERR_MONGOOSE_MULTIPLE_DOCUMENTS_NOT_FOUND',
        message: 'One or more documents not found'
    },
    TakeInvalid: { code: 'ERR_MONGOOSE_TAKE_INVALID', message: 'take must be a positive number' }
}
