import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { IsInt, IsOptional, IsString, Min } from 'class-validator'

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

export class PaginationOption {
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
        const parts = value.split(':')

        if (parts.length !== 2) {
            throw new BadRequestException('Invalid orderby format. It should be name:direction')
        }

        const [name, direction] = parts

        if (!(direction in OrderDirection)) {
            throw new BadRequestException('Invalid direction. It should be either "asc" or "desc".')
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
export class PaginationPipe implements PipeTransform {
    constructor(private takeLimit: number) {}

    transform(value: any, metadata: ArgumentMetadata) {
        if (metadata.type === 'query') {
            if (value instanceof PaginationOption) {
                if (!value.skip) {
                    value.skip = 0
                }

                if (value.take) {
                    if (this.takeLimit < value.take) {
                        throw new BadRequestException(
                            `The 'take' parameter exceeds the maximum allowed limit of ${this.takeLimit}.`
                        )
                    }
                } else {
                    value.take = this.takeLimit
                }
            }
        }

        return value
    }
}
