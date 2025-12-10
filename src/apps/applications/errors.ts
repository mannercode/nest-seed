import {
    BookingServiceErrors,
    TicketPurchaseErrors,
    ShowtimeBulkValidatorServiceErrors,
    MovieDraftErrors
} from './services'

export const ApplicationErrors = {
    TicketPurchase: TicketPurchaseErrors,
    ShowtimeCreation: ShowtimeBulkValidatorServiceErrors,
    Booking: BookingServiceErrors,
    MovieDrafts: MovieDraftErrors
}
