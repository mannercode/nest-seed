import { BadRequestException } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, IsPositive, IsString } from 'class-validator'

export const PaginationErrors = {
    DirectionInvalid: () => ({
        code: 'ERR_PAGINATION_ORDERBY_DIRECTION_INVALID',
        message: 'Invalid direction. It should be either "asc" or "desc".'
    }),
    FormatInvalid: () => ({
        code: 'ERR_PAGINATION_ORDERBY_FORMAT_INVALID',
        message: "Invalid orderby format. It should be 'name:direction'"
    })
}

export const OrderDirection = { Asc: 'asc', Desc: 'desc' } as const

export type OrderDirection = (typeof OrderDirection)[keyof typeof OrderDirection]

export class OrderBy {
    @IsEnum(OrderDirection)
    direction: OrderDirection

    @IsString()
    name: string
}

export class PaginationDto {
    /**
     * `orderby`가 들어오는 형태는 두 가지이다.
     * HTTP 컨트롤러는 `"name:asc"` 같은 문자열로 받고, RPC 컨트롤러는 `{ name, direction }` 객체로 받는다.
     * 두 입력을 모두 받아 같은 형태로 변환한다.
     */
    @IsOptional()
    @Transform(({ value }) => {
        if (value === undefined || value === null) {
            return value
        }

        if (typeof value === 'object') {
            // RPC 경로가 넘기는 {name, direction} 객체만 허용한다.
            // HTTP 쿼리의 `orderby[a]=b` 같은 임의 객체·배열이 그대로 통과하면 정렬 단계에서 500이 된다.
            const { direction, name } = value as Partial<OrderBy>
            if (
                Array.isArray(value) ||
                typeof name !== 'string' ||
                !Object.values(OrderDirection).includes(direction as OrderDirection)
            ) {
                throw new BadRequestException(PaginationErrors.FormatInvalid())
            }
            return { direction, name }
        }

        if (typeof value !== 'string') {
            throw new BadRequestException(PaginationErrors.FormatInvalid())
        }

        const parts = value.split(':').map((part) => part.trim())

        if (parts.length !== 2) {
            throw new BadRequestException(PaginationErrors.FormatInvalid())
        }

        const [name, direction] = parts

        if (!name || !direction) {
            throw new BadRequestException(PaginationErrors.FormatInvalid())
        }

        const parsedDirection = direction as OrderDirection
        if (!Object.values(OrderDirection).includes(parsedDirection)) {
            throw new BadRequestException(PaginationErrors.DirectionInvalid())
        }

        return { direction: parsedDirection, name }
    })
    orderby?: OrderBy

    @IsInt()
    @IsOptional()
    @IsPositive()
    page?: number

    @IsInt()
    @IsOptional()
    @IsPositive()
    size?: number
}

export class PaginationResult<E> {
    items: E[]

    @IsInt()
    page: number

    @IsInt()
    size: number

    @IsInt()
    total: number
}
