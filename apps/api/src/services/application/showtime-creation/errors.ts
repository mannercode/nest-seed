export const ShowtimeCreationErrors = {
    MovieNotFound: (movieId: string) => ({
        code: 'ERR_SHOWTIME_CREATION_MOVIE_NOT_FOUND',
        message: 'The requested movie could not be found.',
        movieId
    }),
    OverlappingStartTimes: (startTimes: Temporal.Instant[]) => ({
        code: 'ERR_SHOWTIME_CREATION_START_TIMES_OVERLAP',
        message: 'Some start times in the request overlap each other.',
        startTimes
    }),
    SagaNotFound: (sagaId: string) => ({
        code: 'ERR_SHOWTIME_CREATION_SAGA_NOT_FOUND',
        message: 'The requested showtime creation saga could not be found.',
        sagaId
    }),
    TooManyShowtimes: (maximum: number) => ({
        code: 'ERR_SHOWTIME_CREATION_TOO_MANY_SHOWTIMES',
        maximum,
        message: `A single request can create at most ${maximum} showtimes.`
    }),
    TooManyTickets: (maximum: number) => ({
        code: 'ERR_SHOWTIME_CREATION_TOO_MANY_TICKETS',
        maximum,
        message: `A single request can create at most ${maximum} tickets.`
    }),
    TheatersNotFound: (theaterIds: string[]) => ({
        code: 'ERR_SHOWTIME_CREATION_THEATERS_NOT_FOUND',
        message: 'One or more requested theaters could not be found.',
        theaterIds
    })
}
