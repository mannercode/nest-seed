export const MongoErrors = {
    DocumentNotFound: (notFoundId: string) => ({
        code: 'ERR_MONGO_DOCUMENT_NOT_FOUND',
        message: 'Document not found',
        notFoundId
    }),
    FiltersRequired: () => ({
        code: 'ERR_MONGO_FILTERS_REQUIRED',
        message: 'At least one filter condition must be provided'
    }),
    InvalidObjectId: (invalidId: string) => ({
        code: 'ERR_MONGO_INVALID_OBJECT_ID',
        message: 'The provided id is not a valid ObjectId',
        invalidId
    }),
    MaxSizeExceeded: (maxSize: number, size: number) => ({
        code: 'ERR_MONGO_MAX_SIZE_EXCEEDED',
        message: "The 'size' parameter exceeds the maximum allowed value",
        maxSize,
        size
    }),
    MultipleDocumentsNotFound: (notFoundIds: string[]) => ({
        code: 'ERR_MONGO_MULTIPLE_DOCUMENTS_NOT_FOUND',
        message: 'One or more documents not found',
        notFoundIds
    }),
    SizeInvalid: (size: number) => ({
        code: 'ERR_MONGO_SIZE_INVALID',
        message: 'size must be a positive number',
        size
    })
}
