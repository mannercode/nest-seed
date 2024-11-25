import { LatLong, latlongDistanceInMeters } from 'common'
import { ShowtimeDto } from 'services/showtimes'
import { TheaterDto } from 'services/theaters'
import { SalesStatusByShowtimeDto } from 'services/tickets'
import { ShowtimeSalesStatusDto } from './dtos'

export function sortTheatersByDistance(theaters: TheaterDto[], latlong: LatLong) {
    return theaters.sort(
        (a, b) =>
            Math.abs(latlongDistanceInMeters(a.latlong, latlong)) -
            Math.abs(latlongDistanceInMeters(b.latlong, latlong))
    )
}

export function generateShowtimesWithSalesStatus(
    showtimes: ShowtimeDto[],
    salesStatuses: SalesStatusByShowtimeDto[]
) {
    const salesStatusMap = new Map(salesStatuses.map((status) => [status.showtimeId, status]))

    const showtimeSalesStatuses: ShowtimeSalesStatusDto[] = showtimes.map((showtime) => {
        const { total, sold, available } = salesStatusMap.get(showtime.id)!

        return { ...showtime, salesStatus: { total, sold, available } }
    })

    return showtimeSalesStatuses
}
