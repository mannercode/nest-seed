import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common'
import { plainToClass } from 'class-transformer'
import { IsNumber, Max, Min, validate } from 'class-validator'

export const LatLongErrors = {
    Required: { code: 'ERR_LATLONG_REQUIRED', message: 'The latLong query parameter is required' },
    FormatInvalid: {
        code: 'ERR_LATLONG_FORMAT_INVALID',
        message: 'LatLong should be in the format "latitude,longitude"'
    },
    ValidationFailed: {
        code: 'ERR_LATLONG_VALIDATION_FAILED',
        message: 'LatLong validation failed'
    }
}

export class LatLong {
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude: number

    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude: number

    static distanceInMeters(pointA: LatLong, pointB: LatLong) {
        const toRad = (degree: number) => degree * (Math.PI / 180)
        const earthRadiusInMeters = 6_371_000 // earth radius in meters

        const lat1 = toRad(pointA.latitude)
        const lon1 = toRad(pointA.longitude)
        const lat2 = toRad(pointB.latitude)
        const lon2 = toRad(pointB.longitude)

        const dLat = lat2 - lat1
        const dLon = lon2 - lon1

        const haversinValue =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

        const centralAngle = 2 * Math.atan2(Math.sqrt(haversinValue), Math.sqrt(1 - haversinValue))
        const distanceInMeters = earthRadiusInMeters * centralAngle

        return distanceInMeters
    }
}

export const LatLongQuery = createParamDecorator(async (name: string, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest()
    const value = request.query[name]

    if (!value) {
        throw new BadRequestException(LatLongErrors.Required)
    }

    const [latStr, longStr] = value.split(',')

    if (!latStr || !longStr) {
        throw new BadRequestException(LatLongErrors.FormatInvalid)
    }

    const latLong = plainToClass(LatLong, {
        latitude: parseFloat(latStr),
        longitude: parseFloat(longStr)
    })

    const errors = await validate(latLong)
    if (errors.length > 0) {
        throw new BadRequestException({
            ...LatLongErrors.ValidationFailed,
            details: errors.map((error) => ({
                field: error.property,
                constraints: error.constraints
            }))
        })
    }

    return latLong
})
