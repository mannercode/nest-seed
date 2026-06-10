export const TheaterErrors = {
    DeleteBlockedByShowtimes: (theaterId: string) => ({
        code: 'ERR_THEATER_HAS_SHOWTIMES',
        message: 'The theater cannot be deleted while showtimes reference it.',
        theaterId
    })
}
