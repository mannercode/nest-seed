import { IsNumber, Max, Min } from 'class-validator'

export class LatLong {
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude: number

    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude: number

    static distanceInMeters(latlong1: LatLong, latlong2: LatLong) {
        const toRad = (degree: number) => degree * (Math.PI / 180)
        const R = 6371000 // earth radius in meters

        const lat1 = toRad(latlong1.latitude)
        const lon1 = toRad(latlong1.longitude)
        const lat2 = toRad(latlong2.latitude)
        const lon2 = toRad(latlong2.longitude)

        const dLat = lat2 - lat1
        const dLon = lon2 - lon1

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

        return R * c // distance in meters
    }
}
export const nullLatLong = { latitude: 0, longitude: 0 }
