export const MovieErrors = {
    AssetNotFound: (notFoundAssetId: string) => ({
        code: 'ERR_MOVIE_ASSET_NOT_FOUND',
        message: 'The asset does not exist in this movie.',
        notFoundAssetId
    }),
    AssetUploadInvalid: (assetId: string) => ({
        code: 'ERR_MOVIE_ASSET_UPLOAD_INVALID',
        message: 'The asset upload could not be validated.',
        assetId
    }),
    InvalidForPublish: (missingFields: string[]) => ({
        code: 'ERR_MOVIE_INVALID_FOR_PUBLISH',
        message: 'The movie is not ready to be published.',
        missingFields
    }),
    NotFound: (notFoundMovieId: string) => ({
        code: 'ERR_MOVIE_NOT_FOUND',
        message: 'The movie does not exist.',
        notFoundMovieId
    }),
    UnsupportedAssetType: (mimeType: string) => ({
        code: 'ERR_MOVIE_ASSET_TYPE_NOT_ALLOWED',
        message: 'Only image uploads are supported.',
        mimeType
    })
}
