export const BookingErrors = {
    ShowtimeNotFound: (showtimeId: string) => ({
        code: 'ERR_BOOKING_SHOWTIME_NOT_FOUND',
        message: 'The requested showtime could not be found.',
        showtimeId
    }),
    TicketsAlreadyHeld: () => ({
        code: 'ERR_BOOKING_TICKETS_ALREADY_HELD',
        message: 'Some tickets are already held by another customer.'
    })
}
