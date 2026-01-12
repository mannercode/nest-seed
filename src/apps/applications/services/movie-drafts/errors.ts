export const MovieDraftErrors = {
    AssetNotFound: {
        code: 'ERR_MOVIE_DRAFT_ASSET_NOT_FOUND',
        message: 'The asset does not exist in this movie draft.'
    },
    AssetUploadInvalid: {
        code: 'ERR_MOVIE_DRAFT_ASSET_UPLOAD_INVALID',
        message: 'The asset upload could not be validated.'
    },
    InvalidForCompletion: {
        code: 'ERR_MOVIE_DRAFT_INCOMPLETE',
        message: 'The movie draft is incomplete.'
    },
    UnsupportedAssetType: {
        code: 'ERR_MOVIE_DRAFT_ASSET_TYPE_NOT_ALLOWED',
        message: 'Only image uploads are supported.'
    }
}
