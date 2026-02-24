import type { ShowtimeDto, TheaterDto, TicketSalesForShowtimeDto } from 'apps/cores'
import { LatLong } from 'common'
import { omit, sortBy } from 'lodash'
import type { BookingShowtimeDto } from './dtos'

export function generateShowtimesForBooking(
    showtimes: ShowtimeDto[],
    ticketSalesForShowtimes: TicketSalesForShowtimeDto[]
) {
    const ticketSalesByShowtime = new Map(
        ticketSalesForShowtimes.map((status) => [status.showtimeId, status])
    )

    const showtimesForBooking = showtimes.map((showtime) => {
        const ticketSales = ticketSalesByShowtime.get(showtime.id)

        return { ...showtime, ticketSales: omit(ticketSales, ['showtimeId']) }
    })

    return showtimesForBooking as BookingShowtimeDto[]
}

export function sortTheatersByDistance(theaters: TheaterDto[], latLong: LatLong) {
    return sortBy(theaters, (theater) =>
        Math.abs(LatLong.distanceInMeters(theater.location, latLong))
    )
}
