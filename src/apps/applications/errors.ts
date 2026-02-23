import { BookingErrors, ShowtimeBulkValidatorErrors, TicketPurchaseErrors } from './services'

export const ApplicationErrors = {
    Booking: BookingErrors,
    ShowtimeCreation: ShowtimeBulkValidatorErrors,
    TicketPurchase: TicketPurchaseErrors
}
