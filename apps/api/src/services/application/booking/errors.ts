export const BookingErrors = {
    HoldLimitExceeded: (maxPerPurchase: number) => ({
        code: 'ERR_BOOKING_HOLD_LIMIT_EXCEEDED',
        message: 'Too many tickets requested to hold at once.',
        maxPerPurchase
    }),
    ShowtimeNotFound: (showtimeId: string) => ({
        code: 'ERR_BOOKING_SHOWTIME_NOT_FOUND',
        message: 'The requested showtime could not be found.',
        showtimeId
    }),
    TicketsAlreadyHeld: () => ({
        code: 'ERR_BOOKING_TICKETS_ALREADY_HELD',
        message: 'Some tickets are already held by another user.'
    }),
    TicketsNotInShowtime: (ticketIds: string[], showtimeId: string) => ({
        code: 'ERR_BOOKING_TICKETS_NOT_IN_SHOWTIME',
        message: 'Some tickets do not belong to the requested showtime.',
        showtimeId,
        ticketIds
    })
}
