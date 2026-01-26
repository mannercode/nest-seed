import {
    BookingServiceErrors,
    TicketPurchaseErrors,
    ShowtimeBulkValidatorServiceErrors
} from './services'

export const ApplicationErrors = {
    TicketPurchase: TicketPurchaseErrors,
    ShowtimeCreation: ShowtimeBulkValidatorServiceErrors,
    Booking: BookingServiceErrors
}
