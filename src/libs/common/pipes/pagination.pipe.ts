import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { IsInt, IsOptional, IsString, Min } from 'class-validator'
import { CommonErrors } from '../common-errors'

export enum OrderDirection {
    asc = 'asc',
    desc = 'desc'
}

export class OrderOption {
    @IsString()
    name: string

    @IsString()
    direction: OrderDirection
}

export class PaginationOptionDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    take?: number

    @IsOptional()
    @IsInt()
    @Min(0)
    skip?: number

    @IsOptional()
    @Transform(({ value }) => {
        if (value.direction && value.name) {
            return value
        }

        const parts = value.split(':')

        if (parts.length !== 2) {
            throw new BadRequestException(CommonErrors.Pagination.FormatInvalid)
        }

        const [name, direction] = parts

        if (!(direction in OrderDirection)) {
            throw new BadRequestException(CommonErrors.Pagination.DirectionInvalid)
        }

        return { name, direction }
    })
    orderby?: OrderOption
}

export class PaginationResult<E> {
    @IsInt()
    skip: number

    @IsInt()
    take: number

    @IsInt()
    total: number

    items: E[]
}

@Injectable()
export abstract class PaginationPipe implements PipeTransform {
    abstract get takeLimit(): number

    transform(value: any, metadata: ArgumentMetadata) {
        if (metadata.type === 'query') {
            if (value instanceof PaginationOptionDto) {
                if (!value.skip) {
                    value.skip = 0
                }

                if (value.take) {
                    if (this.takeLimit < value.take) {
                        throw new BadRequestException({
                            ...CommonErrors.Pagination.TakeLimitExceeded,
                            take: value.take,
                            takeLimit: this.takeLimit
                        })
                    }
                } else {
                    value.take = this.takeLimit
                }
            }
        }

        return value
    }
}
