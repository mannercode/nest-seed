import { BookingErrors } from './booking/index.js'
import { PurchaseErrors } from './purchase/index.js'
import { ShowtimeCreationErrors } from './showtime-creation/index.js'

export const ApplicationErrors = {
    Booking: BookingErrors,
    Purchase: PurchaseErrors,
    ShowtimeCreation: ShowtimeCreationErrors
}
