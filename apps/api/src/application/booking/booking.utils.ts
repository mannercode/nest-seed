import type { ShowtimeDto, TheaterDto, TicketSalesForShowtimeDto } from 'core'
import { LatLong, omit, Require, sortBy } from '@mannercode/common'
import type { BookingShowtimeDto } from './dtos'

export function generateShowtimesForBooking(
    showtimes: ShowtimeDto[],
    ticketSalesForShowtimes: TicketSalesForShowtimeDto[]
): BookingShowtimeDto[] {
    const ticketSalesByShowtime = new Map(
        ticketSalesForShowtimes.map((status) => [status.showtimeId, status])
    )

    return showtimes.map((showtime) => {
        const ticketSales = ticketSalesByShowtime.get(showtime.id)
        Require.defined(ticketSales, `ticketSales missing for showtime ${showtime.id}`)

        return { ...showtime, ticketSales: omit(ticketSales, ['showtimeId']) }
    })
}

export function sortTheatersByDistance(theaters: TheaterDto[], latLong: LatLong) {
    return sortBy(theaters, (theater) => LatLong.distanceInMeters(theater.location, latLong))
}
