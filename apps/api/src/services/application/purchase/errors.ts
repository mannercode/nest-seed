export const PurchaseErrors = {
    AlreadySold: (ticketIds: string[]) => ({
        code: 'ERR_PURCHASE_ALREADY_SOLD',
        message: 'One or more tickets have already been sold.',
        ticketIds
    }),
    DuplicateTickets: () => ({
        code: 'ERR_PURCHASE_DUPLICATE_TICKETS',
        message: 'A purchase cannot contain duplicate tickets.'
    }),
    LimitExceeded: (maxCount: number) => ({
        code: 'ERR_PURCHASE_LIMIT_EXCEEDED',
        message: 'You have exceeded the maximum number of items allowed for purchase.',
        maxCount
    }),
    NotHeld: () => ({
        code: 'ERR_PURCHASE_NOT_HELD',
        message: 'Only held items can be purchased.'
    }),
    MultipleShowtimes: () => ({
        code: 'ERR_PURCHASE_MULTIPLE_SHOWTIMES',
        message: 'A purchase can only contain tickets for one showtime.'
    }),
    TotalPriceMismatch: (expectedPrice: number, totalPrice: number) => ({
        code: 'ERR_PURCHASE_TOTAL_PRICE_MISMATCH',
        message: 'The total price does not match the server-side calculation.',
        expectedPrice,
        totalPrice
    }),
    WindowClosed: (
        purchaseCutoffMinutes: number,
        purchaseWindowCloseTime: string,
        startTime: string
    ) => ({
        code: 'ERR_PURCHASE_WINDOW_CLOSED',
        message: 'Purchase is closed for this showtime.',
        purchaseCutoffMinutes,
        purchaseWindowCloseTime,
        startTime
    })
}
