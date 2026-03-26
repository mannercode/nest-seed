export const MongooseErrors = {
    DocumentNotFound: (notFoundId: string) => ({
        code: 'ERR_MONGOOSE_DOCUMENT_NOT_FOUND',
        message: 'Document not found',
        notFoundId
    }),
    FiltersRequired: () => ({
        code: 'ERR_MONGOOSE_FILTERS_REQUIRED',
        message: 'At least one filter condition must be provided'
    }),
    MaxSizeExceeded: (maxSize: number, size: number) => ({
        code: 'ERR_MONGOOSE_MAX_SIZE_EXCEEDED',
        message: "The 'size' parameter exceeds the maximum allowed value",
        maxSize,
        size
    }),
    MultipleDocumentsNotFound: (notFoundIds: string[]) => ({
        code: 'ERR_MONGOOSE_MULTIPLE_DOCUMENTS_NOT_FOUND',
        message: 'One or more documents not found',
        notFoundIds
    }),
    SizeInvalid: (size: number) => ({
        code: 'ERR_MONGOOSE_SIZE_INVALID',
        message: 'size must be a positive number',
        size
    })
}
