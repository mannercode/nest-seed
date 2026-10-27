export const MovieErrors = {
    AssetTooLarge: (size: number, maxSize: number) => ({
        code: 'ERR_MOVIE_ASSET_TOO_LARGE',
        message: 'The movie image exceeds the maximum upload size.',
        size,
        maxSize
    }),
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
    DeleteBlockedByShowtimes: (movieId: string) => ({
        code: 'ERR_MOVIE_HAS_SHOWTIMES',
        message: 'The movie cannot be deleted while showtimes reference it.',
        movieId
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
    UpdateConflict: (movieId: string) => ({
        code: 'ERR_MOVIE_UPDATE_CONFLICT',
        message: 'The movie changed while it was being updated.',
        movieId
    }),
    UnsupportedAssetType: (mimeType: string) => ({
        code: 'ERR_MOVIE_ASSET_TYPE_NOT_ALLOWED',
        message: 'Only JPEG, PNG, and WebP image uploads are supported.',
        mimeType
    })
}
