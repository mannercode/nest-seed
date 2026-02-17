import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { IsNumber, Max, Min, validate } from 'class-validator'

const EARTH_RADIUS_METERS = 6_371_000
const MAX_COORDINATE_LENGTH = 20

export const LatLongError = {
    Required: { code: 'ERR_LATLONG_REQUIRED', message: 'The latLong query parameter is required' },
    InvalidFormat: {
        code: 'ERR_LATLONG_INVALID_FORMAT',
        message: 'latLong must be in the format "latitude,longitude"'
    },
    OutOfRange: {
        code: 'ERR_LATLONG_OUT_OF_RANGE',
        message: 'Latitude must be between -90 and 90, longitude must be between -180 and 180'
    }
} as const

export class LatLong {
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude: number

    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude: number

    static distanceInMeters(from: LatLong, to: LatLong): number {
        const toRadians = (degrees: number) => degrees * (Math.PI / 180)

        const fromLat = toRadians(from.latitude)
        const fromLng = toRadians(from.longitude)
        const toLat = toRadians(to.latitude)
        const toLng = toRadians(to.longitude)

        const deltaLat = toLat - fromLat
        const deltaLng = toLng - fromLng

        const halfChordSquared =
            Math.sin(deltaLat / 2) ** 2 +
            Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2

        const centralAngle =
            2 * Math.atan2(Math.sqrt(halfChordSquared), Math.sqrt(1 - halfChordSquared))

        return EARTH_RADIUS_METERS * centralAngle
    }
}

function isNumericString(value: string): boolean {
    if (value.length > MAX_COORDINATE_LENGTH) return false
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)
}

function parseCoordinatePair(value: unknown): { latitude: number; longitude: number } | null {
    if (typeof value !== 'string') return null

    const parts = value.split(',')
    if (parts.length !== 2) return null

    const [rawLat, rawLng] = parts
    const latStr = rawLat.trim()
    const lngStr = rawLng.trim()

    if (!isNumericString(latStr) || !isNumericString(lngStr)) return null

    return { latitude: Number(latStr), longitude: Number(lngStr) }
}

export const LatLongQuery = createParamDecorator(
    async (paramName: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest()
        const raw = request.query[paramName]

        if (!raw) {
            throw new BadRequestException(LatLongError.Required)
        }

        const parsed = parseCoordinatePair(raw)

        if (!parsed) {
            throw new BadRequestException(LatLongError.InvalidFormat)
        }

        const latLong = plainToInstance(LatLong, parsed)
        const errors = await validate(latLong)

        if (errors.length > 0) {
            throw new BadRequestException({
                ...LatLongError.OutOfRange,
                details: errors.map((e) => ({ field: e.property, constraints: e.constraints }))
            })
        }

        return latLong
    }
)
