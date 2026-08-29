// 오류 code는 기존 API 응답 호환성을 위해 Mongoose 제거 뒤에도 유지한다.
export const MongoErrors = {
    DocumentNotFound: (notFoundId: string) => ({
        code: 'ERR_MONGOOSE_DOCUMENT_NOT_FOUND',
        message: 'Document not found',
        notFoundId
    }),
    FiltersRequired: () => ({
        code: 'ERR_MONGOOSE_FILTERS_REQUIRED',
        message: 'At least one filter condition must be provided'
    }),
    InvalidObjectId: (invalidId: string) => ({
        code: 'ERR_MONGOOSE_INVALID_OBJECT_ID',
        message: 'The provided id is not a valid ObjectId',
        invalidId
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

// 외부 오류 namespace 호환용이다. 새 구현에서는 MongoErrors를 사용한다.
export const MongooseErrors = MongoErrors
