export const PurchaseErrors = {
    LimitExceeded: {
        code: 'ERR_PURCHASE_LIMIT_EXCEEDED',
        message: 'You have exceeded the maximum number of items allowed for purchase.'
    },
    NotHeld: { code: 'ERR_PURCHASE_NOT_HELD', message: 'Only held items can be purchased.' },
    WindowClosed: {
        code: 'ERR_PURCHASE_WINDOW_CLOSED',
        message: 'Purchase is closed for this showtime.'
    }
}
