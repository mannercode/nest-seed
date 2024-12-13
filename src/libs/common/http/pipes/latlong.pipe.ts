import {
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
    Injectable,
    PipeTransform
} from '@nestjs/common'
import { plainToClass } from 'class-transformer'
import { validate } from 'class-validator'
import { LatLong } from 'common'

@Injectable()
class LatLongPipe implements PipeTransform<string, Promise<LatLong>> {
    async transform(value: string): Promise<LatLong> {
        if (!value) {
            throw new BadRequestException({
                code: 'ERR_LATLONG_REQUIRED',
                message: 'The latlong query parameter is required.'
            })
        }

        const [latStr, longStr] = value.split(',')

        if (!latStr || !longStr) {
            throw new BadRequestException({
                code: 'ERR_LATLONG_FORMAT_INVALID',
                message: 'Latlong should be in the format "latitude,longitude".'
            })
        }

        const latLong = plainToClass(LatLong, {
            latitude: parseFloat(latStr),
            longitude: parseFloat(longStr)
        })

        const errors = await validate(latLong)
        if (errors.length > 0) {
            throw new BadRequestException({
                code: 'ERR_LATLONG_VALIDATION_FAILED',
                message: 'Latlong validation failed.',
                details: errors.map((error) => ({
                    field: error.property,
                    constraints: error.constraints
                }))
            })
        }

        return latLong
    }
}

export const LatLongQuery = createParamDecorator(async (name: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const latlong = request.query[name]

    const pipe = new LatLongPipe()
    return pipe.transform(latlong)
})
