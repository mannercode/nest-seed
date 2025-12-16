import { BadRequestException } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator'

export const PaginationErrors = {
    FormatInvalid: {
        code: 'ERR_PAGINATION_ORDERBY_FORMAT_INVALID',
        message: "Invalid orderby format. It should be 'name:direction'"
    },
    DirectionInvalid: {
        code: 'ERR_PAGINATION_ORDERBY_DIRECTION_INVALID',
        message: 'Invalid direction. It should be either "asc" or "desc".'
    }
}

export enum OrderDirection {
    Asc = 'asc',
    Desc = 'desc'
}

export class OrderBy {
    @IsString()
    name: string

    @IsEnum(OrderDirection)
    direction: OrderDirection
}

export class PaginationDto {
    @IsOptional()
    @IsPositive()
    take?: number

    @IsOptional()
    @IsInt()
    @Min(0)
    skip?: number

    /**
     * In HttpController, 'orderby' is passed as a string (e.g., "name:asc"),
     * in RpcController, it's passed as an object ({ name, direction }).
     *
     * HttpController에서는 'orderby'가 문자열(예: "name:asc")로 전달되고,
     * RpcController에서는 객체({ name, direction })로 전달됩니다.
     */
    @IsOptional()
    @Transform(({ value }) => {
        if (value === undefined || value === null) {
            return value
        }

        if (typeof value === 'object') {
            return value
        }

        if (typeof value !== 'string') {
            throw new BadRequestException(PaginationErrors.FormatInvalid)
        }

        const parts = value.split(':').map((part) => part.trim())

        if (parts.length !== 2) {
            throw new BadRequestException(PaginationErrors.FormatInvalid)
        }

        const [name, direction] = parts

        if (!name || !direction) {
            throw new BadRequestException(PaginationErrors.FormatInvalid)
        }

        const parsedDirection = direction as OrderDirection
        if (!Object.values(OrderDirection).includes(parsedDirection)) {
            throw new BadRequestException(PaginationErrors.DirectionInvalid)
        }

        return { name, direction: parsedDirection }
    })
    orderby?: OrderBy
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
