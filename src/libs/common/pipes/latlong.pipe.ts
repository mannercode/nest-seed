import {
    BadRequestException,
    createParamDecorator,
    ExecutionContext,
    Injectable,
    PipeTransform
} from '@nestjs/common'
import { plainToClass } from 'class-transformer'
import { validate } from 'class-validator'
import { CommonErrors } from '../common-errors'
import { LatLong } from '../types'

@Injectable()
class LatLongPipe implements PipeTransform<string, Promise<LatLong>> {
    async transform(value: string): Promise<LatLong> {
        if (!value) {
            throw new BadRequestException(CommonErrors.LatLong.Required)
        }

        const [latStr, longStr] = value.split(',')

        if (!latStr || !longStr) {
            throw new BadRequestException(CommonErrors.LatLong.FormatInvalid)
        }

        const latLong = plainToClass(LatLong, {
            latitude: parseFloat(latStr),
            longitude: parseFloat(longStr)
        })

        const errors = await validate(latLong)
        if (errors.length > 0) {
            throw new BadRequestException({
                ...CommonErrors.LatLong.ValidationFailed,
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
