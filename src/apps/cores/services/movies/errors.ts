export const MovieErrors = {
    AssetNotFound: {
        code: 'ERR_MOVIE_ASSET_NOT_FOUND',
        message: 'The asset does not exist in this movie.'
    },
    AssetUploadInvalid: {
        code: 'ERR_MOVIE_ASSET_UPLOAD_INVALID',
        message: 'The asset upload could not be validated.'
    },
    InvalidForCompletion: { code: 'ERR_MOVIE_INCOMPLETE', message: 'The movie is incomplete.' },
    UnsupportedAssetType: {
        code: 'ERR_MOVIE_ASSET_TYPE_NOT_ALLOWED',
        message: 'Only image uploads are supported.'
    }
}
