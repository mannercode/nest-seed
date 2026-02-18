export const MovieErrors = {
    AssetNotFound: {
        code: 'ERR_MOVIE_ASSET_NOT_FOUND',
        message: 'The asset does not exist in this movie.'
    },
    AssetUploadInvalid: {
        code: 'ERR_MOVIE_ASSET_UPLOAD_INVALID',
        message: 'The asset upload could not be validated.'
    },
    InvalidForPublish: {
        code: 'ERR_MOVIE_INVALID_FOR_PUBLISH',
        message: 'The movie is not ready to be published.'
    },
    NotFound: { code: 'ERR_MOVIE_NOT_FOUND', message: 'The movie does not exist.' },
    UnsupportedAssetType: {
        code: 'ERR_MOVIE_ASSET_TYPE_NOT_ALLOWED',
        message: 'Only image uploads are supported.'
    }
}
