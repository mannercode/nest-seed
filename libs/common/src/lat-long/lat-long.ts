import { ExecutionContext } from '@nestjs/common'
import { BadRequestException, createParamDecorator } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { IsNumber, Max, Min, validate } from 'class-validator'

const EARTH_RADIUS_METERS = 6_371_000
const MAX_COORDINATE_LENGTH = 20

export const LatLongErrors = {
    InvalidFormat: () => ({
        code: 'ERR_LATLONG_INVALID_FORMAT',
        message: 'latLong must be in the format "latitude,longitude"'
    }),
    OutOfRange: (
        details: Array<{ constraints: Record<string, string> | undefined; field: string }>
    ) => ({
        code: 'ERR_LATLONG_OUT_OF_RANGE',
        message: 'Latitude must be between -90 and 90, longitude must be between -180 and 180',
        details
    }),
    Required: () => ({
        code: 'ERR_LATLONG_REQUIRED',
        message: 'The latLong query parameter is required'
    })
}

export class LatLong {
    @IsNumber()
    @Max(90)
    @Min(-90)
    latitude: number

    @IsNumber()
    @Max(180)
    @Min(-180)
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

function parseCoordinatePair(value: unknown): null | { latitude: number; longitude: number } {
    if (typeof value !== 'string') return null

    const parts = value.split(',')
    if (parts.length !== 2) return null

    const [rawLat, rawLng] = parts
    const latStr = rawLat.trim()
    const lngStr = rawLng.trim()

    if (!isNumericString(latStr) || !isNumericString(lngStr)) return null

    return { latitude: Number(latStr), longitude: Number(lngStr) }
}

export const ParseLatLongQuery = createParamDecorator(
    async (paramName: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest()
        const raw = request.query[paramName]

        if (!raw) {
            throw new BadRequestException(LatLongErrors.Required())
        }

        const parsed = parseCoordinatePair(raw)

        if (!parsed) {
            throw new BadRequestException(LatLongErrors.InvalidFormat())
        }

        const latLong = plainToInstance(LatLong, parsed)
        const errors = await validate(latLong)

        if (errors.length > 0) {
            throw new BadRequestException(
                LatLongErrors.OutOfRange(
                    errors.map((e) => ({ constraints: e.constraints, field: e.property }))
                )
            )
        }

        return latLong
    }
)
