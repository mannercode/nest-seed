export const ShowtimeCreationErrors = {
    MovieNotFound: (movieId: string) => ({
        code: 'ERR_SHOWTIME_CREATION_MOVIE_NOT_FOUND',
        message: 'The requested movie could not be found.',
        movieId
    }),
    OverlappingStartTimes: (startTimes: Date[]) => ({
        code: 'ERR_SHOWTIME_CREATION_START_TIMES_OVERLAP',
        message: 'Some start times in the request overlap each other.',
        startTimes
    }),
    TheatersNotFound: (theaterIds: string[]) => ({
        code: 'ERR_SHOWTIME_CREATION_THEATERS_NOT_FOUND',
        message: 'One or more requested theaters could not be found.',
        theaterIds
    })
}
