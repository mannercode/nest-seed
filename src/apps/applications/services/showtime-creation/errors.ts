export const ShowtimeCreationErrors = {
    MovieNotFound: (movieId: string) => ({
        code: 'ERR_SHOWTIME_CREATION_MOVIE_NOT_FOUND',
        message: 'The requested movie could not be found.',
        movieId
    }),
    TheatersNotFound: (theaterIds: string[]) => ({
        code: 'ERR_SHOWTIME_CREATION_THEATERS_NOT_FOUND',
        message: 'One or more requested theaters could not be found.',
        theaterIds
    })
}
