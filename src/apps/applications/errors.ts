import {
    BookingServiceErrors,
    ShowtimeBulkValidatorServiceErrors,
    TicketPurchaseErrors
} from './services'

export const ApplicationErrors = {
    Booking: BookingServiceErrors,
    ShowtimeCreation: ShowtimeBulkValidatorServiceErrors,
    TicketPurchase: TicketPurchaseErrors
}
