export const MovieDraftErrors = {
    ImageNotFound: {
        code: 'ERR_MOVIE_DRAFT_IMAGE_NOT_FOUND',
        message: 'The image does not exist in this movie draft.'
    },
    ImageUploadInvalid: {
        code: 'ERR_MOVIE_DRAFT_IMAGE_UPLOAD_INVALID',
        message: 'The image upload could not be validated.'
    },
    InvalidForCompletion: {
        code: 'ERR_MOVIE_DRAFT_INCOMPLETE',
        message: 'The movie draft is incomplete.'
    },
    UnsupportedImageType: {
        code: 'ERR_MOVIE_DRAFT_IMAGE_TYPE_NOT_ALLOWED',
        message: 'Only image uploads are supported.'
    },
    Expired: { code: 'ERR_MOVIE_DRAFT_EXPIRED', message: 'The movie draft has expired.' }
}
