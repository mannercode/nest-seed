import type { ShowtimeDto, TheaterDto, TicketSalesForShowtimeDto } from 'apps/cores'
import { LatLong } from 'common'
import type { ShowtimeForBookingDto } from './dtos'

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
        /* istanbul ignore next */
        const { total, sold, available } = ticketSalesByShowtime.get(showtime.id) ?? {}

        return { ...showtime, ticketSales: { total, sold, available } }
    })

    return showtimesForBooking as ShowtimeForBookingDto[]
}
