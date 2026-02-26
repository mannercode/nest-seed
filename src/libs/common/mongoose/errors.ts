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
    MaxTakeExceeded: (maxTake: number, take: number) => ({
        code: 'ERR_MONGOOSE_MAX_TAKE_EXCEEDED',
        message: "The 'take' parameter exceeds the maximum allowed value",
        maxTake,
        take
    }),
    MultipleDocumentsNotFound: (notFoundIds: string[]) => ({
        code: 'ERR_MONGOOSE_MULTIPLE_DOCUMENTS_NOT_FOUND',
        message: 'One or more documents not found',
        notFoundIds
    }),
    TakeInvalid: (take: number) => ({
        code: 'ERR_MONGOOSE_TAKE_INVALID',
        message: 'take must be a positive number',
        take
    })
}
