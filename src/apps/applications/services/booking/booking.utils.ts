import { LatLong } from 'common'
import { SalesStatusByShowtimeDto, ShowtimeDto, TheaterDto } from 'cores'
import { ShowtimeSalesStatusDto } from './dtos'

export function sortTheatersByDistance(theaters: TheaterDto[], latlong: LatLong) {
    return theaters.sort(
        (a, b) =>
            Math.abs(LatLong.distanceInMeters(a.latlong, latlong)) -
            Math.abs(LatLong.distanceInMeters(b.latlong, latlong))
    )
}

export function generateShowtimesWithSalesStatus(
    showtimes: ShowtimeDto[],
    salesStatuses: SalesStatusByShowtimeDto[]
) {
    const salesStatusMap = new Map(salesStatuses.map((status) => [status.showtimeId, status]))

    const showtimeSalesStatuses = showtimes.map((showtime) => {
        const { total, sold, available } = salesStatusMap.get(showtime.id)!

        return { ...showtime, salesStatus: { total, sold, available } }
    })

    return showtimeSalesStatuses as ShowtimeSalesStatusDto[]
}
