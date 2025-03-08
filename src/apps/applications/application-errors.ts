export const ApplicationsErrors = {
    Purchase: {
        MaxTicketsExceeded: {
            code: 'ERR_PURCHASE_MAX_TICKETS_EXCEEDED',
            message: 'You have exceeded the maximum number of tickets allowed for purchase.'
        },
        DeadlineExceeded: {
            code: 'ERR_PURCHASE_DEADLINE_EXCEEDED',
            message: 'The purchase deadline has passed.'
        },
        TicketNotHeld: {
            code: 'ERR_PURCHASE_TICKET_NOT_HELD',
            message: 'Only held tickets can be purchased.'
        }
    },
    ShowtimeCreation: {
        MovieNotFound: {
            code: 'ERR_SHOWTIME_CREATION_MOVIE_NOT_FOUND',
            message: 'The requested movie could not be found.'
        },
        TheaterNotFound: {
            code: 'ERR_SHOWTIME_CREATION_THEATERS_NOT_FOUND',
            message: 'One or more requested theaters could not be found.'
        }
    }
}
