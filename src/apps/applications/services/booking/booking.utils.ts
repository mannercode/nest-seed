import { LatLong } from 'common'
import { omit } from 'lodash'
import type { ShowtimeForBookingDto } from './dtos'
import type { ShowtimeDto, TheaterDto, TicketSalesForShowtimeDto } from 'apps/cores'

export function sortTheatersByDistance(theaters: TheaterDto[], latLong: LatLong) {
    return theaters.sort(
        (a, b) =>
            Math.abs(LatLong.distanceInMeters(a.location, latLong)) -
            Math.abs(LatLong.distanceInMeters(b.location, latLong))
    )
}

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

    return showtimesForBooking as ShowtimeForBookingDto[]
}
